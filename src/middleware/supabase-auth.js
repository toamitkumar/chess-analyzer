/**
 * Supabase Authentication Middleware
 *
 * This middleware:
 * 1. Verifies JWT tokens from Supabase Auth
 * 2. Extracts user ID from the token
 * 3. Syncs user data to local database
 * 4. Attaches userId to req object for downstream use
 */

const { createClient } = require('@supabase/supabase-js');
const { getDatabase } = require('../models/database');

// Initialize Supabase client
// These environment variables should be set in .env:
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_ANON_KEY: Your Supabase anonymous key (for client-side)
// - SUPABASE_SERVICE_KEY: Your Supabase service role key (for server-side, optional)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
} else {
  console.warn('⚠️  Supabase credentials not configured. Authentication will be disabled.');
}

/**
 * Middleware to require authentication on protected routes
 * Verifies Supabase JWT token and attaches userId to request
 */
async function requireAuth(req, res, next) {
  try {
    if (!supabase) {
      return res.status(500).json({
        error: 'Server Error',
        message: 'Authentication service not configured'
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    // Sync user to local database
    await syncUserToDatabase(user);

    // Attach userId to request for downstream use
    req.userId = user.id;
    req.user = user;

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);

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
    if (!supabase) {
      req.userId = null;
      req.user = null;
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without authentication
      req.userId = null;
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        await syncUserToDatabase(user);
        req.userId = user.id;
        req.user = user;
      } else {
        req.userId = null;
        req.user = null;
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
 * Sync Supabase user data to local database
 * Creates or updates user record
 */
async function syncUserToDatabase(supabaseUser) {
  try {
    const db = getDatabase();

    // Extract user data from Supabase user object
    const userData = {
      id: supabaseUser.id,
      email: supabaseUser.email || null,
      username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || null,
      display_name: supabaseUser.user_metadata?.full_name ||
                    supabaseUser.user_metadata?.display_name ||
                    supabaseUser.user_metadata?.username ||
                    supabaseUser.email?.split('@')[0] ||
                    'User',
      avatar_url: supabaseUser.user_metadata?.avatar_url || null,
      chess_username: supabaseUser.user_metadata?.chess_username || null,
      last_login: new Date().toISOString()
    };

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [supabaseUser.id]);

    if (existingUser) {
      // Update existing user
      await db.run(`
        UPDATE users
        SET email = ?,
            username = ?,
            display_name = ?,
            avatar_url = ?,
            chess_username = ?,
            last_login = ?
        WHERE id = ?
      `, [
        userData.email,
        userData.username,
        userData.display_name,
        userData.avatar_url,
        userData.chess_username,
        userData.last_login,
        userData.id
      ]);
    } else {
      // Create new user
      await db.run(`
        INSERT INTO users (id, email, username, display_name, avatar_url, chess_username, last_login, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.id,
        userData.email,
        userData.username,
        userData.display_name,
        userData.avatar_url,
        userData.chess_username,
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

/**
 * Get the Supabase client instance
 * Useful for other modules that need to interact with Supabase
 */
function getSupabaseClient() {
  return supabase;
}

module.exports = {
  requireAuth,
  optionalAuth,
  useDefaultUser,
  getSupabaseClient
};
