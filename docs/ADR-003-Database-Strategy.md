# ADR-003: Database Strategy - Dual-Mode SQLite/PostgreSQL

**Status**: Implemented
**Date**: 2024-11-19 (Original), 2024-12-14 (Documented)
**Author**: Development Team
**Related Issue**: Production deployment requirements

---

## Context and Problem Statement

The chess analysis platform needed a database solution that works for both local development and production deployment on Railway.

### Key Questions:
1. Should we use the same database for development and production?
2. How do we ensure data safety in production?
3. How do we make local development easy without external dependencies?
4. How do we test database operations reliably?

### Requirements:
- **Local development**: Easy setup, no external dependencies
- **Production**: Reliable, backed up, scalable
- **Testing**: Isolated test database, no interference with dev data
- **Migration**: Smooth path from local to production

---

## Decision Drivers

### Development Experience
- **Setup time**: Developers should be productive immediately
- **No external deps**: Shouldn't require PostgreSQL locally
- **Fast iteration**: Quick database resets during development
- **Testing**: Isolated test database that's easy to clean

### Production Requirements
- **Data safety**: Never lose user data
- **Backups**: Automatic, point-in-time recovery
- **Scaling**: Support growing user base
- **Reliability**: Industry-standard database
- **Railway compatibility**: Works with Railway's offerings

### Cost Considerations
- **Development**: Free (local database)
- **Production**: ~$5/month (Railway hobby tier)
- **Total**: Minimal cost while learning/prototyping

---

## Considered Options

### Option 1: PostgreSQL Only
**Approach**: Use PostgreSQL for everything (dev, test, prod)

**Pros**:
- ✅ Single database system (no differences)
- ✅ Production-like development environment
- ✅ Advanced features (arrays, JSON, full-text search)

**Cons**:
- ❌ **Complex local setup**: Requires PostgreSQL installation
- ❌ **Slow onboarding**: New developers need to install/configure
- ❌ **Resource heavy**: PostgreSQL uses more memory
- ❌ **Overkill for learning**: Don't need production DB for experiments

### Option 2: SQLite Only
**Approach**: Use SQLite for everything including production

**Pros**:
- ✅ Zero setup (file-based, built into Node.js)
- ✅ Fast development iteration
- ✅ Simple backups (just copy file)
- ✅ Perfect for single-user app

**Cons**:
- ❌ **No automatic backups**: Manual copy required
- ❌ **Single writer**: Concurrent access limited
- ❌ **File-based risks**: Could lose file on ephemeral storage
- ❌ **Not suitable for multi-user production**

### Option 3: Dual-Mode SQLite/PostgreSQL (Selected)
**Approach**: SQLite for local dev/test, PostgreSQL for production

**Database Abstraction Layer**:
```javascript
class Database {
  constructor() {
    this.usePostgres = !!process.env.DATABASE_URL;

    if (this.usePostgres) {
      // Production: PostgreSQL
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      // Development: SQLite
      this.db = new sqlite3.Database('./data/chess_analysis.db');
    }
  }

  async run(sql, params) {
    if (this.usePostgres) {
      return await this.pool.query(sql, params);
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    }
  }
}
```

**Environment Detection**:
```javascript
// Automatic switching based on environment
if (process.env.DATABASE_URL) {
  // Railway production → PostgreSQL
} else {
  // Local development → SQLite
}
```

**Pros**:
- ✅ **Easy local development**: Zero setup, just npm install
- ✅ **Safe production**: PostgreSQL with automatic backups
- ✅ **Isolated testing**: Separate test database
- ✅ **Smooth transition**: Same code works on both databases
- ✅ **Cost effective**: Free locally, $5/month production

**Cons**:
- ⚠️ **SQL differences**: Must write compatible SQL
- ⚠️ **Testing complexity**: Need to test on both databases
- ⚠️ **Migration handling**: Migrations must work on both

---

## Decision Outcome

**Chosen Option**: **Option 3 - Dual-Mode SQLite/PostgreSQL**

### Rationale:

This approach balances developer experience with production requirements:

1. **Zero-setup development**
   - Clone repo → `npm install` → Start developing
   - No PostgreSQL installation needed
   - Perfect for learning and experimentation

2. **Production-grade deployment**
   - Railway's managed PostgreSQL
   - Automatic daily backups
   - Point-in-time recovery
   - Industry-standard reliability

3. **Clean testing**
   - Separate `chess_analysis_test.db`
   - Easy to reset: `npm run test:clean`
   - No interference with dev data

4. **Minimal complexity**
   - Database abstraction layer handles differences
   - Migrations work on both databases
   - Same queries run on both (with minor adjustments)

---

## Implementation Details

### Database Files

**Development**:
```
data/
├── chess_analysis.db           # Main development database
└── chess_analysis_test.db      # Test database
```

**Production (Railway)**:
```
PostgreSQL database (managed by Railway)
├── Automatic daily backups
├── Point-in-time recovery
└── Connection via DATABASE_URL environment variable
```

### Environment Detection

```javascript
// src/models/database.js
class Database {
  constructor() {
    // Detect environment
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const isProduction = !!process.env.DATABASE_URL;

    // Choose database file (SQLite)
    const dbFileName = isTestEnvironment
      ? 'chess_analysis_test.db'
      : 'chess_analysis.db';

    this.dbPath = path.join(__dirname, '../../data', dbFileName);
    this.usePostgres = isProduction;

    // Initialize connection
    if (this.usePostgres) {
      this.initializePostgreSQL();
    } else {
      this.initializeSQLite();
    }
  }
}
```

### SQL Compatibility Layer

**Database-agnostic types**:
```javascript
getSQLTypes() {
  return {
    idType: this.usePostgres
      ? 'SERIAL PRIMARY KEY'
      : 'INTEGER PRIMARY KEY AUTOINCREMENT',
    timestampType: this.usePostgres
      ? 'TIMESTAMP'
      : 'DATETIME',
    textType: 'TEXT',
    boolType: 'BOOLEAN'
  };
}
```

**Example migration**:
```javascript
// Works on both databases
const { idType, timestampType } = this.db.getSQLTypes();

await this.db.run(`
  CREATE TABLE games (
    id ${idType},
    white TEXT NOT NULL,
    black TEXT NOT NULL,
    date ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
  )
`);
```

### Testing Configuration

**Jest setup** (`tests/setup.js`):
```javascript
// Force test environment
process.env.NODE_ENV = 'test';

// Ensures test database is used
beforeAll(async () => {
  const db = getDatabase();
  await db.initialize();
});

afterAll(async () => {
  // Clean up test database
  const db = getDatabase();
  await db.close();
});
```

**Test database cleanup**:
```bash
# npm script
"test:clean": "rm -f data/chess_analysis_test.db data/test_*.db tests/data/*.db"
```

---

## Migration Strategy

### Schema Migrations

**Migration file example**:
```javascript
class Migration001 {
  async up() {
    const { idType, timestampType } = this.db.getSQLTypes();
    const isPostgres = this.db.usePostgres;

    // Database-agnostic SQL
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id ${idType},
        white TEXT NOT NULL,
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
      )
    `);
  }

  async down() {
    await this.db.run('DROP TABLE IF EXISTS games');
  }
}
```

**Migration tracking**:
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Migration (SQLite → PostgreSQL)

**Export from SQLite**:
```bash
sqlite3 data/chess_analysis.db .dump > backup.sql
```

**Import to PostgreSQL** (via Railway CLI):
```bash
# Convert SQLite dump to PostgreSQL format
# (manual adjustments for syntax differences)

railway run psql < converted_backup.sql
```

**Automated migration** (future):
```javascript
// scripts/migrate-to-postgres.js
// Reads from SQLite, writes to PostgreSQL
// Handles type conversions automatically
```

---

## Database Differences Handled

### SQL Syntax Variations

| Feature | SQLite | PostgreSQL | Solution |
|---------|--------|------------|----------|
| **Auto-increment** | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Use `idType` helper |
| **Timestamp** | `DATETIME` | `TIMESTAMP` | Use `timestampType` helper |
| **Current time** | `CURRENT_TIMESTAMP` | `NOW()` | Conditional in migrations |
| **Array type** | `TEXT` (space-separated) | `TEXT[]` (native array) | Store as TEXT, parse in code |
| **JSON** | `TEXT` | `JSONB` | Store as TEXT, parse in code |
| **Upsert** | `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | Conditional SQL |

### Performance Differences

| Operation | SQLite | PostgreSQL | Notes |
|-----------|--------|------------|-------|
| **Small queries** | Faster (no network) | Slower (network overhead) | Negligible in practice |
| **Large datasets** | Slower (file I/O) | Faster (optimized) | Not an issue at current scale |
| **Concurrent writes** | Single writer | Multiple writers | Only matters in production |
| **Full-text search** | FTS5 extension | Built-in | Use simple LIKE for compatibility |

---

## Trade-offs and Limitations

### Trade-offs Accepted

1. **SQL compatibility layer**
   - **Impact**: Can't use database-specific features without conditions
   - **Mitigation**: Helper functions for common differences
   - **Benefit**: Single codebase works everywhere

2. **Testing on both databases**
   - **Impact**: Should ideally test migrations on PostgreSQL too
   - **Mitigation**: SQL is simple enough that differences are minimal
   - **Future**: Add PostgreSQL testing in CI/CD

3. **Manual data migration**
   - **Impact**: Moving from SQLite to PostgreSQL requires manual export/import
   - **Mitigation**: Documented process in deployment guide
   - **Future**: Automate with migration script

### Known Limitations

1. **Array type handling**
   - SQLite: Store as space-separated TEXT
   - PostgreSQL: Could use native TEXT[] array
   - Current: Use TEXT on both for compatibility

2. **Full-text search**
   - SQLite: Could use FTS5 extension
   - PostgreSQL: Could use built-in full-text search
   - Current: Use simple LIKE queries (good enough for now)

3. **Transaction isolation**
   - SQLite: Serialized transactions
   - PostgreSQL: MVCC (more concurrent)
   - Impact: Minimal (single-user system)

---

## Consequences

### Positive

✅ **Easy onboarding**: New developers productive in minutes
✅ **Safe production**: PostgreSQL with automatic backups
✅ **Clean testing**: Isolated test database
✅ **Cost effective**: Free local dev, $5/month production
✅ **Flexible**: Can develop offline without database server
✅ **Future-proof**: Easy to migrate to PostgreSQL-only if needed

### Negative

⚠️ **SQL compatibility**: Must avoid database-specific features
⚠️ **Testing complexity**: Ideally should test on both databases
⚠️ **Migration manual**: No automated SQLite → PostgreSQL migration

### Neutral

◉ **Abstraction layer**: Adds code but enables flexibility
◉ **Documentation**: Need to document differences for developers

---

## Validation and Testing

### Development Workflow

```bash
# 1. Clone repository
git clone <repo>

# 2. Install dependencies
npm install

# 3. Run tests (uses test database)
npm test

# 4. Start development (uses dev database)
npm start

# No PostgreSQL installation needed!
```

### Production Deployment

```bash
# 1. Deploy to Railway
railway up

# 2. Add PostgreSQL database
railway add postgresql

# 3. DATABASE_URL automatically set
# App detects it and uses PostgreSQL

# 4. Migrations run automatically
# Schema created in PostgreSQL
```

### Test Coverage

- ✅ All database operations tested on SQLite
- ✅ Migrations tested on SQLite
- ⚠️ PostgreSQL testing manual (should add to CI/CD)

---

## Future Improvements

### Short-term (Next 3 months)

1. **Automated migration script**
   - One-command SQLite → PostgreSQL migration
   - Handles type conversions automatically

2. **CI/CD PostgreSQL testing**
   - Run tests against both databases
   - Catch compatibility issues early

3. **Migration validation**
   - Test migrations on both databases before merging
   - Prevent database-specific SQL

### Long-term (6+ months)

1. **PostgreSQL-only development** (optional)
   - If team grows, standardize on PostgreSQL
   - Use Docker Compose for local PostgreSQL
   - Maintains prod/dev parity

2. **Database monitoring**
   - Track query performance on both databases
   - Identify optimization opportunities

3. **Sharding/replication**
   - If scale requires it, PostgreSQL supports this
   - SQLite does not

---

## References

### Related Files
- `src/models/database.js` - Database abstraction layer
- `src/models/migrations/` - Schema migrations
- `tests/setup.js` - Test environment configuration
- `docs/guides/database-configuration.md` - Usage guide
- `docs/guides/deployment.md` - Deployment instructions

### External Resources
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Railway PostgreSQL Guide](https://docs.railway.app/databases/postgresql)
- [Database Abstraction Patterns](https://martinfowler.com/eaaCatalog/gateway.html)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-11-19 | 0.1 | Initial dual-mode implementation | Development Team |
| 2024-12-14 | 1.0 | Formalized as ADR | Development Team |

---

## Approval

This design decision is implemented and working well. The dual-mode strategy successfully balances developer experience with production reliability.
