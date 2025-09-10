import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { storage } from './storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

export function setupOAuth() {
  // Only setup OAuth if environment variables are provided
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

  // Google OAuth Strategy
  if (googleClientId && googleClientSecret) {
    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: "/api/auth/google/callback"
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      let user = await storage.getUserByGoogleId(profile.id);
      
      if (user) {
        return done(null, user);
      }
      
      // Check if user exists with same email
      if (profile.emails && profile.emails[0]) {
        user = await storage.getUserByEmail(profile.emails[0].value);
        if (user) {
          // Update existing user with Google ID
          user = await storage.updateUser(user.id, {
            googleId: profile.id,
            authProvider: 'google',
            profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value,
          });
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = await storage.createUser({
        username: profile.displayName || `user_${profile.id}`,
        email: profile.emails?.[0]?.value || '',
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        profileImageUrl: profile.photos?.[0]?.value,
        googleId: profile.id,
        authProvider: 'google',
      });
      
      return done(null, newUser);
    } catch (error) {
      return done(error, undefined);
    }
    }));
  }

  // GitHub OAuth Strategy
  if (githubClientId && githubClientSecret) {
    passport.use(new GitHubStrategy({
      clientID: githubClientId,
      clientSecret: githubClientSecret,
      callbackURL: "/api/auth/github/callback"
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      let user = await storage.getUserByGithubId(profile.id);
      
      if (user) {
        return done(null, user);
      }
      
      // Check if user exists with same email
      if (profile.emails && profile.emails[0]) {
        user = await storage.getUserByEmail(profile.emails[0].value);
        if (user) {
          // Update existing user with GitHub ID
          user = await storage.updateUser(user.id, {
            githubId: profile.id,
            authProvider: 'github',
            profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value,
          });
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = await storage.createUser({
        username: profile.username || `user_${profile.id}`,
        email: profile.emails?.[0]?.value || '',
        firstName: profile.displayName?.split(' ')[0],
        lastName: profile.displayName?.split(' ').slice(1).join(' '),
        profileImageUrl: profile.photos?.[0]?.value,
        githubId: profile.id,
        authProvider: 'github',
      });
      
      return done(null, newUser);
    } catch (error) {
      return done(error, undefined);
    }
    }));
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}