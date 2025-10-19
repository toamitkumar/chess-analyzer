import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { TournamentService } from '../../services/tournament.service';

@Component({
  selector: 'app-tournament-creator',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatDialogModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatSelectModule, 
    MatButtonModule, 
    MatOptionModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Create New Tournament</h2>
    
    <mat-dialog-content>
      <form #tournamentForm="ngForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tournament Name</mat-label>
          <input matInput 
                 [(ngModel)]="tournament.name" 
                 name="name" 
                 required 
                 placeholder="e.g., World Championship 2024">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Event Type</mat-label>
          <mat-select [(ngModel)]="tournament.eventType" name="eventType">
            <mat-option value="standard">Standard</mat-option>
            <mat-option value="blitz">Blitz</mat-option>
            <mat-option value="rapid">Rapid</mat-option>
            <mat-option value="classical">Classical</mat-option>
            <mat-option value="bullet">Bullet</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Location</mat-label>
          <input matInput 
                 [(ngModel)]="tournament.location" 
                 name="location" 
                 placeholder="e.g., New York, Online">
        </mat-form-field>

        <div class="date-row">
          <mat-form-field appearance="outline">
            <mat-label>Start Date</mat-label>
            <input matInput 
                   type="date" 
                   [(ngModel)]="tournament.startDate" 
                   name="startDate">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End Date</mat-label>
            <input matInput 
                   type="date" 
                   [(ngModel)]="tournament.endDate" 
                   name="endDate">
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button 
              color="primary" 
              (click)="onCreate()" 
              [disabled]="!tournament.name || creating">
        {{ creating ? 'Creating...' : 'Create Tournament' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    
    .date-row {
      display: flex;
      gap: 16px;
    }
    
    .date-row mat-form-field {
      flex: 1;
    }
    
    mat-dialog-content {
      min-width: 400px;
    }
  `]
})
export class TournamentCreatorComponent {
  @Output() tournamentCreated = new EventEmitter<any>();

  tournament = {
    name: '',
    eventType: 'standard',
    location: '',
    startDate: '',
    endDate: ''
  };

  creating = false;

  constructor(
    private tournamentService: TournamentService,
    private dialogRef: MatDialogRef<TournamentCreatorComponent>
  ) {}

  async onCreate() {
    if (!this.tournament.name) return;

    try {
      this.creating = true;
      
      const tournamentData = {
        name: this.tournament.name,
        eventType: this.tournament.eventType,
        location: this.tournament.location || undefined,
        startDate: this.tournament.startDate || undefined,
        endDate: this.tournament.endDate || undefined
      };

      const createdTournament = await this.tournamentService.createTournament(tournamentData).toPromise();
      
      this.tournamentCreated.emit(createdTournament);
      this.dialogRef.close(createdTournament);
      
    } catch (error) {
      console.error('Failed to create tournament:', error);
      alert('Failed to create tournament. Please try again.');
    } finally {
      this.creating = false;
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
