import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-import',
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatExpansionModule],
  templateUrl: './import.html',
  styleUrl: './import.css'
})
export class Import {
  isDragOver = false;
  isUploading = false;
  uploadProgress = 0;
  results: any[] = [];

  constructor(private http: HttpClient) {}

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
      .filter(f => f.name.endsWith('.pgn')) as File[];
    if (files.length > 0) {
      this.processFiles(files);
    }
  }

  onFileSelect(event: any) {
    const files = Array.from(event.target.files) as File[];
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
        const result = await this.uploadPGN(file);
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

  async uploadPGN(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('pgn', file);

    return new Promise((resolve, reject) => {
      this.http.post('http://localhost:3000/api/upload/pgn', formData).subscribe({
        next: (response: any) => {
          resolve({
            message: `Successfully imported ${response.gamesCount || 0} games from ${file.name}`,
            totalGames: response.gamesCount || 0,
            games: response.games || []
          });
        },
        error: (error) => {
          reject(new Error(error.error?.message || 'Upload failed'));
        }
      });
    });
  }
}
