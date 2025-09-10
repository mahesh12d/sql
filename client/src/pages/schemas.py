from pydantic import BaseModel
from typing import Optional, List

class User(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None

    class Config:
        orm_mode = True

class UserUpsert(User):
    pass

class ProblemBase(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str
    starter_code: str
    tags: List[str]
    companies: List[str]

class ProblemOut(ProblemBase):
    solvedCount: int
    isUserSolved: bool

    class Config:
        orm_mode = True

class SubmissionCreate(BaseModel):
    problem_id: int
    user_code: str

class SubmissionOut(BaseModel):
    id: int
    problem_id: int
    user_id: str
    is_correct: bool

    class Config:
        orm_mode = True
