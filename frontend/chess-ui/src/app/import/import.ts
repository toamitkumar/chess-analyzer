import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-import',
  imports: [CommonModule],
  templateUrl: './import.html',
  styleUrl: './import.css'
})
export class Import {
  isDragOver = false;
  isUploading = false;
  uploadProgress = 0;
  results: any[] = [];

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const files = Array.from(event.dataTransfer?.files || [])
      .filter(f => f.name.endsWith('.pgn'));
    if (files.length > 0) {
      this.processFiles(files);
    }
  }

  onFileSelect(event: any) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      this.processFiles(files);
    }
  }

  async processFiles(files: File[]) {
    this.results = [];
    this.isUploading = true;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.uploadProgress = ((i + 1) / files.length) * 100;
      
      try {
        const content = await this.readFile(file);
        const result = await this.uploadPGN(content, file.name);
        this.results.push({ ...result, filename: file.name, success: true });
      } catch (error: any) {
        this.results.push({ 
          filename: file.name, 
          success: false, 
          message: error.message || 'Upload failed' 
        });
      }
    }
    
    this.isUploading = false;
  }

  readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async uploadPGN(content: string, filename: string) {
    // Mock successful upload for demo
    return {
      message: `Successfully imported games from ${filename}`,
      totalGames: Math.floor(Math.random() * 10) + 1,
      games: [
        {
          white: 'Player1',
          black: 'Player2', 
          result: '1-0',
          date: '2024.01.15',
          moveCount: 42
        }
      ]
    };
  }
}
