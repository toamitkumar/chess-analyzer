const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileStorage {
  constructor() {
    this.baseDir = path.join(__dirname, '../../data');
    this.pgnDir = path.join(this.baseDir, 'pgn');
    this.tournamentsDir = path.join(this.baseDir, 'tournaments');
    this.backupDir = path.join(this.baseDir, 'backups');
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [this.baseDir, this.pgnDir, this.tournamentsDir, this.backupDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  // Create tournament folder
  createTournamentFolder(tournamentName) {
    const sanitizedName = this.sanitizeFolderName(tournamentName);
    const tournamentPath = path.join(this.tournamentsDir, sanitizedName);
    
    if (!fs.existsSync(tournamentPath)) {
      fs.mkdirSync(tournamentPath, { recursive: true });
      console.log(`🏆 Created tournament folder: ${sanitizedName}`);
    }
    
    return tournamentPath;
  }

  // Store PGN file in tournament folder
  async storePGNInTournament(pgnContent, originalFileName, tournamentName) {
    try {
      const tournamentPath = this.createTournamentFolder(tournamentName);
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const hash = crypto.createHash('md5').update(pgnContent).digest('hex').substring(0, 8);
      const fileName = `${timestamp}_${hash}_${this.sanitizeFileName(originalFileName)}`;
      const filePath = path.join(tournamentPath, fileName);
      
      fs.writeFileSync(filePath, pgnContent, 'utf8');
      console.log(`💾 Stored PGN in tournament folder: ${tournamentName}/${fileName}`);
      
      return {
        filePath,
        relativePath: path.join('tournaments', this.sanitizeFolderName(tournamentName), fileName),
        tournamentFolder: this.sanitizeFolderName(tournamentName),
        fileName
      };
    } catch (error) {
      console.error('❌ Failed to store PGN in tournament folder:', error.message);
      throw error;
    }
  }

  // List tournament folders
  listTournamentFolders() {
    try {
      if (!fs.existsSync(this.tournamentsDir)) {
        return [];
      }
      
      return fs.readdirSync(this.tournamentsDir)
        .filter(item => {
          const itemPath = path.join(this.tournamentsDir, item);
          return fs.statSync(itemPath).isDirectory();
        })
        .map(folderName => ({
          name: folderName,
          path: path.join(this.tournamentsDir, folderName),
          fileCount: this.countPGNFiles(path.join(this.tournamentsDir, folderName))
        }));
    } catch (error) {
      console.error('❌ Failed to list tournament folders:', error.message);
      return [];
    }
  }

  // List PGN files in tournament folder
  listTournamentFiles(tournamentName) {
    try {
      const tournamentPath = path.join(this.tournamentsDir, this.sanitizeFolderName(tournamentName));
      
      if (!fs.existsSync(tournamentPath)) {
        return [];
      }
      
      return fs.readdirSync(tournamentPath)
        .filter(file => file.endsWith('.pgn'))
        .map(fileName => ({
          name: fileName,
          path: path.join(tournamentPath, fileName),
          size: fs.statSync(path.join(tournamentPath, fileName)).size,
          modified: fs.statSync(path.join(tournamentPath, fileName)).mtime
        }));
    } catch (error) {
      console.error('❌ Failed to list tournament files:', error.message);
      return [];
    }
  }

  // Count PGN files in directory
  countPGNFiles(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) return 0;
      return fs.readdirSync(dirPath).filter(file => file.endsWith('.pgn')).length;
    } catch (error) {
      return 0;
    }
  }

  // Read PGN file
  readPGNFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('❌ Failed to read PGN file:', error.message);
      throw error;
    }
  }

  // Sanitize folder name for filesystem
  sanitizeFolderName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .trim()
      .substring(0, 100); // Limit length
  }

  // Sanitize file name
  sanitizeFileName(name) {
    const ext = path.extname(name);
    const baseName = path.basename(name, ext);
    return this.sanitizeFolderName(baseName) + ext;
  }

  // Legacy methods for backward compatibility
  async storePGNFile(pgnContent, originalFileName) {
    // Store in legacy date-based structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dateDir = path.join(this.pgnDir, year.toString(), month);
    
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    
    const hash = crypto.createHash('md5').update(pgnContent).digest('hex').substring(0, 8);
    const timestamp = now.toISOString().slice(0, 10);
    const fileName = `game_${timestamp.replace(/-/g, '')}_${hash}.pgn`;
    const filePath = path.join(dateDir, fileName);
    
    fs.writeFileSync(filePath, pgnContent, 'utf8');
    return filePath;
  }
}

// Singleton instance
let fileStorageInstance = null;

function getFileStorage() {
  if (!fileStorageInstance) {
    fileStorageInstance = new FileStorage();
  }
  return fileStorageInstance;
}

module.exports = { FileStorage, getFileStorage };
