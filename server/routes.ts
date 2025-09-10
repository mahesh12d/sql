import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSubmissionSchema, insertCommunityPostSchema, insertPostCommentSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import session from "express-session";
import { setupOAuth } from "./oauth";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
  }));

  // Initialize passport and session
  app.use(passport.initialize());
  app.use(passport.session());
  setupOAuth();

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = userData.passwordHash ? await bcrypt.hash(userData.passwordHash, saltRounds) : undefined;
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        passwordHash,
      });

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: '24h'
      });

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          problemsSolved: user.problemsSolved,
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Verify password
      if (!user.passwordHash) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: '24h'
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          problemsSolved: user.problemsSolved,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Get current user
  app.get('/api/auth/user', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        problemsSolved: user.problemsSolved,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Problem routes
  app.get('/api/problems', async (req, res) => {
    try {
      const { difficulty } = req.query;
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      let problems;
      
      // If user is authenticated, include solve status
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          const userId = decoded.userId;
          
          if (difficulty && typeof difficulty === 'string') {
            problems = await storage.getProblemsByDifficultyForUser(difficulty, userId);
          } else {
            problems = await storage.getAllProblemsForUser(userId);
          }
        } catch (jwtError) {
          // If token is invalid, fall back to unauthenticated response
          if (difficulty && typeof difficulty === 'string') {
            problems = await storage.getProblemsByDifficulty(difficulty);
          } else {
            problems = await storage.getAllProblems();
          }
        }
      } else {
        // Unauthenticated user
        if (difficulty && typeof difficulty === 'string') {
          problems = await storage.getProblemsByDifficulty(difficulty);
        } else {
          problems = await storage.getAllProblems();
        }
      }
      
      res.json(problems);
    } catch (error) {
      console.error('Get problems error:', error);
      res.status(500).json({ message: 'Failed to fetch problems' });
    }
  });

  app.get('/api/problems/:id', async (req, res) => {
    try {
      const problem = await storage.getProblemById(req.params.id);
      if (!problem) {
        return res.status(404).json({ message: 'Problem not found' });
      }
      res.json(problem);
    } catch (error) {
      console.error('Get problem error:', error);
      res.status(500).json({ message: 'Failed to fetch problem' });
    }
  });

  // OAuth routes
  app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  
  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      // Successful authentication, create JWT and redirect
      const user = req.user as any;
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.redirect(`/?token=${token}`);
    }
  );

  app.get('/api/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
  
  app.get('/api/auth/github/callback', 
    passport.authenticate('github', { failureRedirect: '/' }),
    (req, res) => {
      // Successful authentication, create JWT and redirect
      const user = req.user as any;
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.redirect(`/?token=${token}`);
    }
  );

  // Submission routes
  app.post('/api/submissions', authenticateToken, async (req: any, res) => {
    try {
      const submissionData = insertSubmissionSchema.parse({
        ...req.body,
        userId: req.user.userId,
      });

      // Simulate SQL query execution
      const isCorrect = await simulateQueryExecution(submissionData.query, submissionData.problemId);
      const executionTime = Math.floor(Math.random() * 500) + 50; // Random execution time

      const submission = await storage.createSubmission({
        ...submissionData,
        isCorrect,
        executionTime,
      });

      // If correct, update user progress
      if (isCorrect) {
        await storage.updateUserProgress(req.user.userId);
      }

      res.json({
        ...submission,
        message: isCorrect ? 'Query executed successfully!' : 'Query has errors or incorrect result',
      });
    } catch (error) {
      console.error('Submission error:', error);
      res.status(500).json({ message: 'Failed to submit solution' });
    }
  });

  app.get('/api/submissions/user/:userId', authenticateToken, async (req: any, res) => {
    try {
      // Users can only view their own submissions
      if (req.params.userId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const submissions = await storage.getUserSubmissions(req.params.userId);
      res.json(submissions);
    } catch (error) {
      console.error('Get submissions error:', error);
      res.status(500).json({ message: 'Failed to fetch submissions' });
    }
  });

  // Leaderboard routes
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const { limit } = req.query;
      const leaderboard = await storage.getLeaderboard(
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json(leaderboard.map(user => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        problemsSolved: user.problemsSolved,
      })));
    } catch (error) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  // Community routes
  app.get('/api/community/posts', async (req, res) => {
    try {
      const posts = await storage.getAllCommunityPosts();
      res.json(posts.map(post => ({
        ...post,
        user: {
          id: post.user.id,
          username: post.user.username,
          firstName: post.user.firstName,
          lastName: post.user.lastName,
          profileImageUrl: post.user.profileImageUrl,
        }
      })));
    } catch (error) {
      console.error('Get community posts error:', error);
      res.status(500).json({ message: 'Failed to fetch community posts' });
    }
  });

  app.post('/api/community/posts', authenticateToken, async (req: any, res) => {
    try {
      const postData = insertCommunityPostSchema.parse({
        ...req.body,
        userId: req.user.userId,
      });

      const post = await storage.createCommunityPost(postData);
      res.status(201).json(post);
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ message: 'Failed to create post' });
    }
  });

  app.post('/api/community/posts/:postId/like', authenticateToken, async (req: any, res) => {
    try {
      await storage.likeCommunityPost(req.user.userId, req.params.postId);
      res.json({ message: 'Post liked successfully' });
    } catch (error) {
      console.error('Like post error:', error);
      res.status(500).json({ message: 'Failed to like post' });
    }
  });

  app.delete('/api/community/posts/:postId/like', authenticateToken, async (req: any, res) => {
    try {
      await storage.unlikeCommunityPost(req.user.userId, req.params.postId);
      res.json({ message: 'Post unliked successfully' });
    } catch (error) {
      console.error('Unlike post error:', error);
      res.status(500).json({ message: 'Failed to unlike post' });
    }
  });

  app.get('/api/community/posts/:postId/comments', async (req, res) => {
    try {
      const comments = await storage.getPostComments(req.params.postId);
      res.json(comments.map(comment => ({
        ...comment,
        user: {
          id: comment.user.id,
          username: comment.user.username,
          firstName: comment.user.firstName,
          lastName: comment.user.lastName,
          profileImageUrl: comment.user.profileImageUrl,
        }
      })));
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: 'Failed to fetch comments' });
    }
  });

  app.post('/api/community/posts/:postId/comments', authenticateToken, async (req: any, res) => {
    try {
      const commentData = insertPostCommentSchema.parse({
        ...req.body,
        userId: req.user.userId,
        postId: req.params.postId,
      });

      const comment = await storage.createPostComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions
async function simulateQueryExecution(query: string, problemId: string): Promise<boolean> {
  // This is a simplified simulation. In a real app, you'd run the query against a sandbox database.
  const problem = await storage.getProblemById(problemId);
  if (!problem) return false;

  // Simple validation: check if query contains basic SQL keywords and structure
  const normalizedQuery = query.toLowerCase().trim();
  
  // Basic checks for different problem types
  if (problem.title.toLowerCase().includes('sum')) {
    return normalizedQuery.includes('select') && 
           normalizedQuery.includes('from') && 
           (normalizedQuery.includes('sum') || normalizedQuery.includes('+'));
  }
  
  if (problem.title.toLowerCase().includes('join')) {
    return normalizedQuery.includes('select') && 
           normalizedQuery.includes('from') && 
           normalizedQuery.includes('join');
  }
  
  // Default validation: must contain SELECT and FROM
  return normalizedQuery.includes('select') && normalizedQuery.includes('from');
}

