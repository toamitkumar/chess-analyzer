# Chess Analyzer - Production Deployment Guide

## Critical Requirement: Data Persistence
Your PGN files and analysis data are **mission-critical** and must never be lost.

## Recommended Setup: Railway + PostgreSQL

### Why This Guarantees Data Safety:
1. ✅ PostgreSQL with automatic backups
2. ✅ Point-in-time recovery
3. ✅ High availability
4. ✅ No ephemeral storage issues
5. ✅ Industry-standard reliability

---

## Quick Migration from SQLite to PostgreSQL

### Step 1: Install PostgreSQL Dependencies

```bash
cd /Users/amit.kumar3/projects/chess-analysis/chesspulse
npm install pg pg-hstore
```

### Step 2: Database Configuration

Create `src/config/database.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.DATABASE_URL; // PostgreSQL connection string

// PostgreSQL setup (for production)
const pgPool = usePostgres ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
}) : null;

// SQLite setup (for development)
const sqliteDb = !usePostgres ? new sqlite3.Database('./data/chess-analysis.db') : null;

// Unified database interface
const db = {
  query: async (sql, params = []) => {
    if (usePostgres) {
      const result = await pgPool.query(sql, params);
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

  run: async (sql, params = []) => {
    if (usePostgres) {
      await pgPool.query(sql, params);
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      });
    }
  }
};

module.exports = db;
```

### Step 3: Deploy to Railway

```bash
# Login
railway login

# Create new project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Your app will automatically get DATABASE_URL environment variable
```

### Step 4: Migrate Existing Data (If Any)

Export from SQLite:
```bash
sqlite3 data/chess-analysis.db .dump > backup.sql
```

Import to PostgreSQL (via Railway CLI):
```bash
railway run psql < backup.sql
```

---

## Alternative: Keep SQLite with Persistent Volume

If you prefer to keep SQLite:

### Railway Configuration

Create `railway.json`:
```json
{
  "deploy": {
    "volumeMounts": [
      {
        "mountPath": "/app/data",
        "name": "chess-data"
      }
    ]
  }
}
```

### Backup Strategy for SQLite

Add to `package.json`:
```json
{
  "scripts": {
    "backup": "node scripts/backup-database.js"
  }
}
```

Create `scripts/backup-database.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DB_PATH = './data/chess-analysis.db';
const BACKUP_DIR = './backups';
const timestamp = new Date().toISOString().replace(/:/g, '-');
const backupPath = path.join(BACKUP_DIR, `chess-db-${timestamp}.db`);

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Copy database file
fs.copyFileSync(DB_PATH, backupPath);

// Upload to cloud storage (optional - add your preferred service)
console.log(`✅ Backup created: ${backupPath}`);
```

---

## Deployment Checklist

- [ ] Database persistence configured
- [ ] Automatic backups enabled
- [ ] Environment variables set
- [ ] Health checks configured
- [ ] Error monitoring setup (Sentry, LogRocket)
- [ ] Database backup tested
- [ ] Disaster recovery plan documented

---

## Cost Estimates

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| Railway | App + PostgreSQL | $5 (free credit) + $5-10 |
| Render | App + PostgreSQL + Disk | $7 + Free DB |
| Heroku | App + PostgreSQL | $7 + $7 |
| DigitalOcean | Droplet + Managed DB | $6 + $15 |

**Recommendation:** Railway ($10-15/month total) - Best value with reliability

---

## Emergency Data Recovery

### Daily Automated Backups (Railway)

Railway provides automatic backups for PostgreSQL. Access via:
```bash
railway variables  # Get DATABASE_URL
railway run pg_dump $DATABASE_URL > backup.sql
```

### Manual Backup Before Deployment

```bash
# Always backup before major changes
npm run backup
git add backups/
git commit -m "Backup before deployment"
```

---

## Support & Monitoring

After deployment, set up:
1. **Uptime monitoring**: UptimeRobot (free)
2. **Error tracking**: Sentry (free tier)
3. **Database monitoring**: Railway dashboard
4. **Backup notifications**: Cron job + email

---

## Next Steps

Choose one:

**Option A: PostgreSQL (Recommended)**
- Zero data loss risk
- Professional-grade reliability
- Easy scaling

**Option B: SQLite + Persistent Volume**
- Simpler setup
- Good for smaller datasets
- Requires backup strategy
