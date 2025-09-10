import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Environment detection
const isReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Neon configuration
neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

// SSL Configuration based on environment
if (isDevelopment) {
  // For development (both local and Replit), disable strict SSL verification
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  console.log("🔓 SSL verification disabled for development");
}

if (!process.env.DATABASE_URL) {
  const environmentHelp = isReplit 
    ? "Make sure PostgreSQL is enabled in your Replit environment" 
    : "Set DATABASE_URL in your local environment (.env file)";
  
  throw new Error(
    `DATABASE_URL must be set. ${environmentHelp}`
  );
}

// Database connection configuration
const dbConfig: any = {
  connectionString: process.env.DATABASE_URL,
};

// SSL configuration based on environment
if (isProduction) {
  // Production: Enable SSL but don't reject unauthorized (for compatibility)
  dbConfig.ssl = { rejectUnauthorized: false };
} else if (isReplit) {
  // Replit development: No SSL for internal connections
  dbConfig.ssl = false;
} else {
  // Local development: Typically no SSL needed
  dbConfig.ssl = false;
}

// Log connection info (without exposing sensitive data)
const dbUrl = new URL(process.env.DATABASE_URL);
console.log(`🗄️  Database: ${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`);
console.log(`🔧 Environment: ${isReplit ? 'Replit' : 'Local'} (${process.env.NODE_ENV || 'development'})`);

export const pool = new Pool(dbConfig);
export const db = drizzle({ client: pool, schema });