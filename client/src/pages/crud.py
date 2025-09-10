from sqlalchemy.orm import Session
import models, schemas
from sqlalchemy import func, case, literal_column

def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def upsert_user(db: Session, user: schemas.UserUpsert):
    db_user = db.query(models.User).filter(models.User.id == user.id).first()
    if db_user:
        db_user.email = user.email
        db_user.first_name = user.first_name
        db_user.last_name = user.last_name
        db_user.profile_image_url = user.profile_image_url
    else:
        db_user = models.User(**user.dict())
        db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_problems(db: Session, user_id: str | None):
    # Subquery for total correct submissions count per problem
    solved_count_sq = db.query(
        models.Submission.problem_id,
        func.count(models.Submission.user_id.distinct()).label("solved_count")
    ).filter(models.Submission.is_correct == True).group_by(models.Submission.problem_id).subquery()

    # Subquery to check if the current user has solved the problem
    user_solved_sq = None
    if user_id:
        user_solved_sq = db.query(
            models.Submission.problem_id,
            literal_column("1").label("is_user_solved")
        ).filter(
            models.Submission.user_id == user_id,
            models.Submission.is_correct == True
        ).distinct().subquery()

    # Main query
    query = db.query(
        models.Problem,
        func.coalesce(solved_count_sq.c.solved_count, 0).label("solvedCount")
    ).outerjoin(
        solved_count_sq, models.Problem.id == solved_count_sq.c.problem_id
    )

    if user_solved_sq is not None:
        query = query.add_columns(
            case(
                (user_solved_sq.c.is_user_solved != None, True),
                else_=False
            ).label("isUserSolved")
        ).outerjoin(
            user_solved_sq, models.Problem.id == user_solved_sq.c.problem_id
        )
    else:
        # If no user, isUserSolved is always false
        query = query.add_columns(literal_column("false").label("isUserSolved"))
    
    problems_with_stats = query.all()

    # Manually construct the output to match the Pydantic schema
    results = []
    for problem, solved_count, is_user_solved in problems_with_stats:
        results.append(schemas.ProblemOut(
            id=problem.id,
            title=problem.title,
            description=problem.description,
            difficulty=problem.difficulty,
            starter_code=problem.starter_code,
            tags=problem.tags or [],
            companies=problem.companies or [],
            solvedCount=solved_count,
            isUserSolved=is_user_solved
        ))
    return results

def get_problem(db: Session, problem_id: int):
    return db.query(models.Problem).filter(models.Problem.id == problem_id).first()

def create_submission(db: Session, submission: schemas.SubmissionCreate, user_id: str):
    # Mocking correctness check. In a real app, this would execute the SQL.
    is_correct = "select" in submission.user_code.lower() and "from" in submission.user_code.lower()
    db_sub = models.Submission(
        problem_id=submission.problem_id,
        user_id=user_id,
        user_code=submission.user_code,
        is_correct=is_correct
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

def get_user_submissions(db: Session, user_id: str):
    return db.query(models.Submission).filter(models.Submission.user_id == user_id).all()
