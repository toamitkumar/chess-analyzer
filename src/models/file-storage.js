const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileStorage {
  constructor() {
    this.baseDir = path.join(__dirname, '../../data');
    this.pgnDir = path.join(this.baseDir, 'pgn');
    this.backupDir = path.join(this.baseDir, 'backups');
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [this.baseDir, this.pgnDir, this.backupDir];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  generateFileName(originalName) {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = crypto.createHash('md5').update(originalName + Date.now()).digest('hex').slice(0, 8);
    const extension = path.extname(originalName) || '.pgn';
    
    return `game_${timestamp}_${hash}${extension}`;
  }

  getYearMonthPath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const yearDir = path.join(this.pgnDir, String(year));
    const monthDir = path.join(yearDir, month);
    
    // Ensure year/month directories exist
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
    
    return monthDir;
  }

  async storePGNFile(content, originalName) {
    try {
      const fileName = this.generateFileName(originalName);
      const monthDir = this.getYearMonthPath();
      const filePath = path.join(monthDir, fileName);
      
      // Check for duplicates by content hash
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');
      const existingFile = await this.findFileByContentHash(contentHash);
      
      if (existingFile) {
        console.log(`📄 Duplicate file detected, using existing: ${existingFile}`);
        return existingFile;
      }
      
      // Write file with content hash as metadata
      const metadata = {
        originalName,
        contentHash,
        uploadDate: new Date().toISOString(),
        fileSize: Buffer.byteLength(content, 'utf8')
      };
      
      const fileWithMetadata = `# Metadata: ${JSON.stringify(metadata)}\n${content}`;
      
      fs.writeFileSync(filePath, fileWithMetadata, 'utf8');
      console.log(`✅ PGN file stored: ${filePath}`);
      
      return filePath;
      
    } catch (error) {
      console.error('❌ Error storing PGN file:', error.message);
      throw error;
    }
  }

  async findFileByContentHash(contentHash) {
    try {
      const years = fs.readdirSync(this.pgnDir).filter(item => 
        fs.statSync(path.join(this.pgnDir, item)).isDirectory()
      );
      
      for (const year of years) {
        const yearPath = path.join(this.pgnDir, year);
        const months = fs.readdirSync(yearPath).filter(item =>
          fs.statSync(path.join(yearPath, item)).isDirectory()
        );
        
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const files = fs.readdirSync(monthPath).filter(file => file.endsWith('.pgn'));
          
          for (const file of files) {
            const filePath = path.join(monthPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract metadata from first line
            const metadataMatch = content.match(/^# Metadata: (.+)$/m);
            if (metadataMatch) {
              try {
                const metadata = JSON.parse(metadataMatch[1]);
                if (metadata.contentHash === contentHash) {
                  return filePath;
                }
              } catch (e) {
                // Ignore files with invalid metadata
              }
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error searching for duplicate file:', error.message);
      return null;
    }
  }

  readPGNFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Remove metadata line if present
      const lines = content.split('\n');
      if (lines[0].startsWith('# Metadata:')) {
        return lines.slice(1).join('\n');
      }
      
      return content;
    } catch (error) {
      console.error('❌ Error reading PGN file:', error.message);
      throw error;
    }
  }

  getFileMetadata(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const metadataMatch = content.match(/^# Metadata: (.+)$/m);
      
      if (metadataMatch) {
        return JSON.parse(metadataMatch[1]);
      }
      
      // Fallback metadata for files without embedded metadata
      const stats = fs.statSync(filePath);
      return {
        originalName: path.basename(filePath),
        uploadDate: stats.birthtime.toISOString(),
        fileSize: stats.size,
        contentHash: null
      };
    } catch (error) {
      console.error('❌ Error reading file metadata:', error.message);
      return null;
    }
  }

  listStoredFiles() {
    try {
      const files = [];
      const years = fs.readdirSync(this.pgnDir).filter(item => 
        fs.statSync(path.join(this.pgnDir, item)).isDirectory()
      );
      
      years.forEach(year => {
        const yearPath = path.join(this.pgnDir, year);
        const months = fs.readdirSync(yearPath).filter(item =>
          fs.statSync(path.join(yearPath, item)).isDirectory()
        );
        
        months.forEach(month => {
          const monthPath = path.join(yearPath, month);
          const monthFiles = fs.readdirSync(monthPath)
            .filter(file => file.endsWith('.pgn'))
            .map(file => ({
              path: path.join(monthPath, file),
              name: file,
              metadata: this.getFileMetadata(path.join(monthPath, file))
            }));
          
          files.push(...monthFiles);
        });
      });
      
      return files.sort((a, b) => 
        new Date(b.metadata?.uploadDate || 0) - new Date(a.metadata?.uploadDate || 0)
      );
    } catch (error) {
      console.error('❌ Error listing stored files:', error.message);
      return [];
    }
  }

  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error deleting file:', error.message);
      return false;
    }
  }

  getStorageStats() {
    try {
      const files = this.listStoredFiles();
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.fileSize || 0), 0);
      
      return {
        totalFiles,
        totalSize,
        formattedSize: this.formatBytes(totalSize),
        oldestFile: files[files.length - 1]?.metadata?.uploadDate,
        newestFile: files[0]?.metadata?.uploadDate
      };
    } catch (error) {
      console.error('❌ Error getting storage stats:', error.message);
      return { totalFiles: 0, totalSize: 0, formattedSize: '0 B' };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
let storageInstance = null;

function getFileStorage() {
  if (!storageInstance) {
    storageInstance = new FileStorage();
  }
  return storageInstance;
}

module.exports = { FileStorage, getFileStorage };
