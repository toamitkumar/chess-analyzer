import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { TournamentService, Tournament } from '../../services/tournament.service';

@Component({
  selector: 'app-tournament-selector',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatOptionModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" class="tournament-selector">
      <mat-label>Tournament</mat-label>
      <mat-select 
        [value]="selectedTournamentId" 
        (selectionChange)="onTournamentChange($event.value)"
        [disabled]="loading">
        <mat-option [value]="null">All Tournaments</mat-option>
        <mat-option 
          *ngFor="let tournament of tournaments" 
          [value]="tournament.id">
          {{ tournament.name }} ({{ tournament.total_games }} games)
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
  styles: [`
    .tournament-selector {
      min-width: 250px;
      width: 100%;
    }
    
    @media (max-width: 768px) {
      .tournament-selector {
        min-width: 200px;
        width: 100%;
      }
    }
  `]
})
export class TournamentSelectorComponent implements OnInit {
  @Input() selectedTournamentId: number | null = null;
  @Output() tournamentChange = new EventEmitter<number | null>();

  tournaments: Tournament[] = [];
  loading = false;

  constructor(private tournamentService: TournamentService) {
    console.log('TournamentSelectorComponent constructor called');
  }

  ngOnInit() {
    console.log('TournamentSelectorComponent ngOnInit called');
    this.loadTournaments();
  }

  loadTournaments() {
    console.log('Loading tournaments...');
    this.loading = true;
    
    this.tournamentService.getTournaments().subscribe({
      next: (tournaments) => {
        console.log('Tournaments loaded:', tournaments);
        this.tournaments = tournaments || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load tournaments:', error);
        this.tournaments = [];
        this.loading = false;
      }
    });
  }

  onTournamentChange(tournamentId: number | null) {
    this.selectedTournamentId = tournamentId;
    this.tournamentChange.emit(tournamentId);
  }
}
