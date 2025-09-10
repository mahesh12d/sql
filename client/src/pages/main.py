from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import models, schemas, crud
from database import engine, Base, get_db

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Mock auth dependency, similar to the one in server/routes.ts
class MockUserClaims(BaseModel):
    sub: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    profile_image_url: Optional[str]

class MockAuth(BaseModel):
    claims: MockUserClaims

def mock_auth_user() -> MockAuth:
    # Mock user for development
    return MockAuth(claims=MockUserClaims(
      sub="mock-user-1",
      email="jane@techcorp.com",
      first_name="Jane",
      last_name="Smith",
      profile_image_url=None,
    ))

# ---------------- AUTH ----------------
@app.get("/api/auth/user", response_model=schemas.User)
def get_current_user(user: MockAuth = Depends(mock_auth_user), db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user.claims.sub)
    if not db_user:
        claims = user.claims
        user_data = schemas.UserUpsert(
            id=claims.sub,
            email=claims.email,
            first_name=claims.first_name,
            last_name=claims.last_name,
            profile_image_url=claims.profile_image_url,
        )
        db_user = crud.upsert_user(db, user=user_data)
    return db_user

# ---------------- PROBLEMS ----------------
@app.get("/api/problems", response_model=list[schemas.ProblemOut])
def list_problems(user: MockAuth = Depends(mock_auth_user), db: Session = Depends(get_db)):
    user_id = user.claims.sub
    return crud.get_problems(db, user_id=user_id)

@app.get("/api/problems/{problem_id}", response_model=schemas.ProblemBase)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    problem = crud.get_problem(db, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

# ---------------- SUBMISSIONS ----------------
@app.post("/api/submissions", response_model=schemas.SubmissionOut)
def submit(sub: schemas.SubmissionCreate, user: MockAuth = Depends(mock_auth_user), db: Session = Depends(get_db)):
    user_id = user.claims.sub
    return crud.create_submission(db, sub, user_id=user_id)

@app.get("/api/user/submissions", response_model=list[schemas.SubmissionOut])
def get_user_submissions(user: MockAuth = Depends(mock_auth_user), db: Session = Depends(get_db)):
    submissions = crud.get_user_submissions(db, user_id=user.claims.sub)
    return submissions
