const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const usePostgres = !!process.env.DATABASE_URL; // PostgreSQL connection string from Railway/Heroku

// PostgreSQL setup (for production)
const pgPool = usePostgres ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
}) : null;

// SQLite setup (for development)
const sqliteDb = !usePostgres ? new sqlite3.Database('./data/chess-analysis.db', (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err);
  } else {
    console.log('✅ Connected to SQLite database (development mode)');
  }
}) : null;

if (usePostgres) {
  console.log('✅ Using PostgreSQL database (production mode)');
}

// Unified database interface
const db = {
  /**
   * Execute a SELECT query
   * @param {string} sql - SQL query with $1, $2 placeholders for PostgreSQL or ? for SQLite
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  query: async (sql, params = []) => {
    if (usePostgres) {
      // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

      const result = await pgPool.query(pgSql, params);
      return result.rows;
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  },

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Result with lastID and changes
   */
  run: async (sql, params = []) => {
    if (usePostgres) {
      // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

      // Add RETURNING id for INSERT statements if not already present
      const isInsert = /^\s*INSERT\s+INTO/i.test(pgSql);
      const hasReturning = /RETURNING/i.test(pgSql);
      if (isInsert && !hasReturning) {
        pgSql = pgSql.trim().replace(/;?\s*$/, '') + ' RETURNING id';
      }

      const result = await pgPool.query(pgSql, params);
      return {
        lastID: result.rows[0]?.id,
        changes: result.rowCount,
        id: result.rows[0]?.id  // Add id field for compatibility
      };
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes, id: this.lastID });
        });
      });
    }
  },

  /**
   * Get a single row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Single row result
   */
  get: async (sql, params = []) => {
    if (usePostgres) {
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

      const result = await pgPool.query(pgSql, params);
      return result.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }
  },

  /**
   * Execute multiple statements (for schema creation)
   * @param {string} sql - SQL statements
   * @returns {Promise<void>}
   */
  exec: async (sql) => {
    if (usePostgres) {
      await pgPool.query(sql);
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  },

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  close: async () => {
    if (usePostgres) {
      await pgPool.end();
    } else if (sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
};

module.exports = db;
