/**
 * Clerk Authentication Middleware
 *
 * This middleware:
 * 1. Verifies JWT tokens from Clerk
 * 2. Extracts user ID from the token
 * 3. Syncs user data to local database
 * 4. Attaches userId to req object for downstream use
 */

const { createClerkClient } = require('@clerk/clerk-sdk-node');
const { getDatabase } = require('../models/database');

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

/**
 * Middleware to require authentication on protected routes
 * Verifies Clerk session token and attaches userId to request
 */
async function requireAuth(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the session token with Clerk
    let sessionClaims;
    try {
      sessionClaims = await clerk.verifyToken(token);
    } catch (verifyError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    const userId = sessionClaims.sub; // User ID is in the 'sub' claim

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authentication token'
      });
    }

    // Fetch user data from Clerk
    const user = await clerk.users.getUser(userId);

    // Sync user to local database
    await syncUserToDatabase(user);

    // Attach userId to request for downstream use
    req.userId = userId;
    req.user = user;

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);

    // Handle specific Clerk errors
    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token has expired'
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional auth middleware - allows both authenticated and unauthenticated requests
 * If token is present, validates it and attaches user; otherwise continues without user
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without authentication
      req.userId = null;
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    let sessionClaims;
    try {
      sessionClaims = await clerk.verifyToken(token);
      const userId = sessionClaims.sub;

      if (userId) {
        const user = await clerk.users.getUser(userId);
        await syncUserToDatabase(user);
        req.userId = userId;
        req.user = user;
      }
    } catch (verifyError) {
      // Token verification failed, continue without auth
      req.userId = null;
      req.user = null;
    }

    next();
  } catch (error) {
    // If token verification fails, continue without auth
    console.warn('⚠️  Optional auth failed:', error.message);
    req.userId = null;
    req.user = null;
    next();
  }
}

/**
 * Sync Clerk user data to local database
 * Creates or updates user record
 */
async function syncUserToDatabase(clerkUser) {
  try {
    const db = getDatabase();

    const userData = {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || null,
      username: clerkUser.username || null,
      display_name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'User',
      avatar_url: clerkUser.imageUrl || null,
      last_login: new Date().toISOString()
    };

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [clerkUser.id]);

    if (existingUser) {
      // Update existing user
      await db.run(`
        UPDATE users
        SET email = ?,
            username = ?,
            display_name = ?,
            avatar_url = ?,
            last_login = ?
        WHERE id = ?
      `, [
        userData.email,
        userData.username,
        userData.display_name,
        userData.avatar_url,
        userData.last_login,
        userData.id
      ]);
    } else {
      // Create new user
      await db.run(`
        INSERT INTO users (id, email, username, display_name, avatar_url, last_login, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.id,
        userData.email,
        userData.username,
        userData.display_name,
        userData.avatar_url,
        userData.last_login,
        new Date().toISOString()
      ]);

      console.log(`✅ New user created: ${userData.username || userData.email}`);
    }
  } catch (error) {
    console.error('❌ Failed to sync user to database:', error);
    // Don't throw - allow request to continue even if sync fails
  }
}

/**
 * Middleware to use default user for development/testing
 * Use this during transition period to support both auth and non-auth requests
 */
function useDefaultUser(req, res, next) {
  if (!req.userId) {
    req.userId = 'default_user';
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  useDefaultUser,
  clerk
};
