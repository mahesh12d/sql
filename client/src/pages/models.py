from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)

    submissions = relationship("Submission", back_populates="user")

class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    difficulty = Column(String)
    starter_code = Column(Text)
    tags = Column(JSON, default=[], nullable=False)
    companies = Column(JSON, default=[], nullable=False)

    submissions = relationship("Submission", back_populates="problem")

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"))
    user_id = Column(String, ForeignKey("users.id"))
    user_code = Column(Text)
    is_correct = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")
