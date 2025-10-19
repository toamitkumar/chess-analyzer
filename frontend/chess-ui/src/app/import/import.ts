import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog } from '@angular/material/dialog';
import { TournamentService } from '../services/tournament.service';
import { TournamentSelectorComponent } from '../components/tournament-selector/tournament-selector';
import { NavigationComponent } from '../components/navigation/navigation.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-import',
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    TournamentSelectorComponent,
    NavigationComponent
  ],
  templateUrl: './import.html',
  styleUrl: './import.css'
})
export class Import {
  selectedFiles: File[] = [];
  selectedTournamentId: number | null = null;
  uploading = false;
  uploadProgress: any[] = [];
  isDragOver = false;
  showCreateTournament = false;

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService,
    private dialog: MatDialog
  ) {}

  onTournamentChange(tournamentId: number | null) {
    this.selectedTournamentId = tournamentId;
  }

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
    const files = Array.from(event.dataTransfer?.files || []) as File[];
    this.selectedFiles = [...this.selectedFiles, ...files.filter(f => f.name.endsWith('.pgn'))];
  }

  onFileSelected(event: any) {
    const files = Array.from(event.target.files || []) as File[];
    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  clearFiles() {
    this.selectedFiles = [];
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async uploadFiles() {
    if (this.selectedFiles.length === 0) return;
    
    this.uploading = true;
    this.uploadProgress = [];

    for (let i = 0; i < this.selectedFiles.length; i++) {
      const file = this.selectedFiles[i];
      try {
        this.uploadProgress.push({
          fileName: file.name,
          status: 'uploading',
          message: 'Uploading...'
        });

        await this.uploadSingleFile(file);
        
        this.uploadProgress[i] = {
          fileName: file.name,
          status: 'success',
          message: 'Upload successful'
        };
      } catch (error: any) {
        this.uploadProgress[i] = {
          fileName: file.name,
          status: 'error',
          message: error.message || 'Upload failed'
        };
      }
    }

    this.uploading = false;
  }

  private uploadSingleFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('pgn', file);
      if (this.selectedTournamentId) {
        formData.append('tournamentId', this.selectedTournamentId.toString());
      }

      this.http.post(`${environment.apiUrl}/api/upload`, formData).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          reject(new Error(error.error?.message || 'Upload failed'));
        }
      });
    });
  }

  getProgressIcon(status: string): string {
    switch (status) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      default: return 'upload';
    }
  }

  onTournamentCreated(tournament: any) {
    this.selectedTournamentId = tournament.id;
    this.showCreateTournament = false;
  }

  openTournamentCreator() {
    this.showCreateTournament = true;
  }
}
