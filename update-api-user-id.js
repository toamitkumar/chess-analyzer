#!/usr/bin/env node

/**
 * Script to add userId parameter to all database method calls in api-server.js
 */

const fs = require('fs');
const path = require('path');

const apiServerPath = path.join(__dirname, 'src/api/api-server.js');
let content = fs.readFileSync(apiServerPath, 'utf8');

// Track number of replacements
let replacements = 0;

// Replacement patterns for database method calls that need userId
const patterns = [
  // findTournamentByName
  {
    search: /database\.findTournamentByName\(([^)]+)\)(?!\s*,\s*req\.userId)/g,
    replace: (match, param) => {
      replacements++;
      return `database.findTournamentByName(${param}, req.userId || 'default_user')`;
    }
  },
  // getPerformanceMetrics
  {
    search: /database\.getPerformanceMetrics\(([^)]*)\)(?!\s*,\s*req\.userId)/g,
    replace: (match, param) => {
      replacements++;
      const params = param.trim();
      if (params === '') {
        return `database.getPerformanceMetrics(null, req.userId || 'default_user')`;
      }
      return `database.getPerformanceMetrics(${params}, req.userId || 'default_user')`;
    }
  },
  // getGameAnalysis
  {
    search: /database\.getGameAnalysis\(([^)]+)\)(?!\s*,\s*req\.userId)/g,
    replace: (match, param) => {
      replacements++;
      return `database.getGameAnalysis(${param}, req.userId || 'default_user')`;
    }
  },
  // getAlternativeMoves
  {
    search: /database\.getAlternativeMoves\(([^)]+)\)(?!\s*,\s*req\.userId)/g,
    replace: (match, param) => {
      replacements++;
      return `database.getAlternativeMoves(${param}, req.userId || 'default_user')`;
    }
  },
  // getPositionEvaluation
  {
    search: /database\.getPositionEvaluation\(([^)]+)\)(?!\s*,\s*req\.userId)/g,
    replace: (match, param) => {
      replacements++;
      return `database.getPositionEvaluation(${param}, req.userId || 'default_user')`;
    }
  },
  // Direct SELECT queries need to filter by user_id
  // Pattern: database.get('SELECT * FROM games WHERE id = ?', [gameId])
  {
    search: /database\.get\('SELECT \* FROM games WHERE id = \?',\s*\[([^\]]+)\]\)(?!\s*\/\/\s*UPDATED)/g,
    replace: (match, param) => {
      replacements++;
      return `database.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [${param}, req.userId || 'default_user']) // UPDATED`;
    }
  },
  // Pattern: database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId])
  {
    search: /database\.get\('SELECT \* FROM blunder_details WHERE id = \?',\s*\[([^\]]+)\]\)(?!\s*\/\/\s*UPDATED)/g,
    replace: (match, param) => {
      replacements++;
      return `database.get(\`
      SELECT bd.* FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.id = ? AND g.user_id = ?
    \`, [${param}, req.userId || 'default_user']) // UPDATED`;
    }
  }
];

// Apply all patterns
patterns.forEach(({ search, replace }) => {
  content = content.replace(search, replace);
});

// Write back to file
fs.writeFileSync(apiServerPath, content, 'utf8');

console.log(`✅ Updated ${replacements} database method calls in api-server.js`);
console.log(`📝 Please review the changes and test the endpoints`);
