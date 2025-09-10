import {
  users,
  problems,
  submissions,
  communityPosts,
  postLikes,
  postComments,
  type User,
  type InsertUser,
  type Problem,
  type InsertProblem,
  type Submission,
  type InsertSubmission,
  type CommunityPost,
  type InsertCommunityPost,
  type PostComment,
  type InsertPostComment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  getLeaderboard(limit?: number): Promise<User[]>;
  updateUserProgress(userId: string): Promise<void>;

  // Problem operations
  getAllProblems(): Promise<(Problem & { solvedCount: number })[]>;
  getAllProblemsForUser(userId: string): Promise<(Problem & { solvedCount: number; isUserSolved: boolean })[]>;
  getProblemById(id: string): Promise<Problem | undefined>;
  getProblemsByDifficulty(difficulty: string): Promise<(Problem & { solvedCount: number })[]>;
  getProblemsByDifficultyForUser(difficulty: string, userId: string): Promise<(Problem & { solvedCount: number; isUserSolved: boolean })[]>;
  createProblem(problem: InsertProblem): Promise<Problem>;

  // Submission operations
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getUserSubmissions(userId: string): Promise<Submission[]>;
  getUserSubmissionForProblem(userId: string, problemId: string): Promise<Submission[]>;

  // Community operations
  getAllCommunityPosts(): Promise<(CommunityPost & { user: User })[]>;
  createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost>;
  likeCommunityPost(userId: string, postId: string): Promise<void>;
  unlikeCommunityPost(userId: string, postId: string): Promise<void>;
  getPostComments(postId: string): Promise<(PostComment & { user: User })[]>;
  createPostComment(comment: InsertPostComment): Promise<PostComment>;

}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.githubId, githubId));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getLeaderboard(limit: number = 50): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.problemsSolved))
      .limit(limit);
  }

  async updateUserProgress(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        problemsSolved: sql`${users.problemsSolved} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Problem operations
  async getAllProblems(): Promise<(Problem & { solvedCount: number })[]> {
    const result = await db
      .select({
        id: problems.id,
        title: problems.title,
        description: problems.description,
        difficulty: problems.difficulty,
        tags: problems.tags,
        companies: problems.companies,
        schema: problems.schema,
        expectedOutput: problems.expectedOutput,
        hints: problems.hints,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
        solvedCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${submissions.isCorrect} = true THEN ${submissions.userId} END), 0)`,
      })
      .from(problems)
      .leftJoin(submissions, eq(problems.id, submissions.problemId))
      .groupBy(problems.id)
      .orderBy(problems.title);
    
    return result.map(row => ({
      ...row,
      solvedCount: Number(row.solvedCount)
    }));
  }

  async getProblemById(id: string): Promise<Problem | undefined> {
    const [problem] = await db.select().from(problems).where(eq(problems.id, id));
    return problem;
  }

  async getProblemsByDifficulty(difficulty: string): Promise<(Problem & { solvedCount: number })[]> {
    const result = await db
      .select({
        id: problems.id,
        title: problems.title,
        description: problems.description,
        difficulty: problems.difficulty,
        tags: problems.tags,
        companies: problems.companies,
        schema: problems.schema,
        expectedOutput: problems.expectedOutput,
        hints: problems.hints,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
        solvedCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${submissions.isCorrect} = true THEN ${submissions.userId} END), 0)`,
      })
      .from(problems)
      .leftJoin(submissions, eq(problems.id, submissions.problemId))
      .where(eq(problems.difficulty, difficulty))
      .groupBy(problems.id)
      .orderBy(problems.title);
    
    return result.map(row => ({
      ...row,
      solvedCount: Number(row.solvedCount)
    }));
  }

  async getAllProblemsForUser(userId: string): Promise<(Problem & { solvedCount: number; isUserSolved: boolean })[]> {
    const result = await db
      .select({
        id: problems.id,
        title: problems.title,
        description: problems.description,
        difficulty: problems.difficulty,
        tags: problems.tags,
        companies: problems.companies,
        schema: problems.schema,
        expectedOutput: problems.expectedOutput,
        hints: problems.hints,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
        solvedCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${submissions.isCorrect} = true THEN ${submissions.userId} END), 0)`,
        isUserSolved: sql<boolean>`COALESCE(MAX(CASE WHEN ${submissions.userId} = ${userId} AND ${submissions.isCorrect} = true THEN 1 ELSE 0 END), 0) = 1`,
      })
      .from(problems)
      .leftJoin(submissions, eq(problems.id, submissions.problemId))
      .groupBy(problems.id)
      .orderBy(problems.title);
    
    return result.map(row => ({
      ...row,
      solvedCount: Number(row.solvedCount),
      isUserSolved: Boolean(row.isUserSolved)
    }));
  }

  async getProblemsByDifficultyForUser(difficulty: string, userId: string): Promise<(Problem & { solvedCount: number; isUserSolved: boolean })[]> {
    const result = await db
      .select({
        id: problems.id,
        title: problems.title,
        description: problems.description,
        difficulty: problems.difficulty,
        tags: problems.tags,
        companies: problems.companies,
        schema: problems.schema,
        expectedOutput: problems.expectedOutput,
        hints: problems.hints,
        createdAt: problems.createdAt,
        updatedAt: problems.updatedAt,
        solvedCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${submissions.isCorrect} = true THEN ${submissions.userId} END), 0)`,
        isUserSolved: sql<boolean>`COALESCE(MAX(CASE WHEN ${submissions.userId} = ${userId} AND ${submissions.isCorrect} = true THEN 1 ELSE 0 END), 0) = 1`,
      })
      .from(problems)
      .leftJoin(submissions, eq(problems.id, submissions.problemId))
      .where(eq(problems.difficulty, difficulty))
      .groupBy(problems.id)
      .orderBy(problems.title);
    
    return result.map(row => ({
      ...row,
      solvedCount: Number(row.solvedCount),
      isUserSolved: Boolean(row.isUserSolved)
    }));
  }

  async createProblem(problemData: InsertProblem): Promise<Problem> {
    const [problem] = await db.insert(problems).values([problemData]).returning();
    return problem;
  }


  // Submission operations
  async createSubmission(submissionData: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values(submissionData).returning();
    return submission;
  }

  async getUserSubmissions(userId: string): Promise<Submission[]> {
    return await db
      .select()
      .from(submissions)
      .where(eq(submissions.userId, userId))
      .orderBy(desc(submissions.submittedAt));
  }

  async getUserSubmissionForProblem(userId: string, problemId: string): Promise<Submission[]> {
    return await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.userId, userId), eq(submissions.problemId, problemId)))
      .orderBy(desc(submissions.submittedAt));
  }

  // Community operations
  async getAllCommunityPosts(): Promise<(CommunityPost & { user: User })[]> {
    return await db
      .select({
        id: communityPosts.id,
        userId: communityPosts.userId,
        content: communityPosts.content,
        codeSnippet: communityPosts.codeSnippet,
        likes: communityPosts.likes,
        comments: communityPosts.comments,
        createdAt: communityPosts.createdAt,
        updatedAt: communityPosts.updatedAt,
        user: users,
      })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.userId, users.id))
      .orderBy(desc(communityPosts.createdAt));
  }

  async createCommunityPost(postData: InsertCommunityPost): Promise<CommunityPost> {
    const [post] = await db.insert(communityPosts).values(postData).returning();
    return post;
  }

  async likeCommunityPost(userId: string, postId: string): Promise<void> {
    await db.insert(postLikes).values({ userId, postId });
    await db
      .update(communityPosts)
      .set({ likes: sql`${communityPosts.likes} + 1` })
      .where(eq(communityPosts.id, postId));
  }

  async unlikeCommunityPost(userId: string, postId: string): Promise<void> {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)));
    await db
      .update(communityPosts)
      .set({ likes: sql`${communityPosts.likes} - 1` })
      .where(eq(communityPosts.id, postId));
  }

  async getPostComments(postId: string): Promise<(PostComment & { user: User })[]> {
    return await db
      .select({
        id: postComments.id,
        userId: postComments.userId,
        postId: postComments.postId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        user: users,
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.postId, postId))
      .orderBy(postComments.createdAt);
  }

  async createPostComment(commentData: InsertPostComment): Promise<PostComment> {
    const [comment] = await db.insert(postComments).values(commentData).returning();
    await db
      .update(communityPosts)
      .set({ comments: sql`${communityPosts.comments} + 1` })
      .where(eq(communityPosts.id, commentData.postId));
    return comment;
  }

}

export const storage = new DatabaseStorage();
