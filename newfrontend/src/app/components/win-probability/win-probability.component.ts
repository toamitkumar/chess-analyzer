import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-win-probability',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="win-probability-container">
      <div class="probability-bar-vertical" 
           [style.width.px]="barWidth"
           [style.height.px]="barHeight">
        
        <!-- Black advantage section (top) -->
        <div class="black-section" 
             [style.height.%]="blackPercentage"
             [class.winning]="blackPercentage > 50">
        </div>
        
        <!-- White advantage section (bottom) -->
        <div class="white-section" 
             [style.height.%]="whitePercentage"
             [class.winning]="whitePercentage > 50">
        </div>
      </div>
    </div>
  `,
  styles: [`
    .win-probability-container {
      @apply flex items-center;
    }

    .probability-bar-vertical {
      @apply relative flex flex-col overflow-hidden border border-gray-300;
      transition: all 0.3s ease-in-out;
      border-radius: 0;
    }

    .white-section {
      background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
      transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .white-section.winning {
      background: linear-gradient(180deg, #ffffff 0%, #f1f3f4 100%);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .black-section {
      background: linear-gradient(180deg, #343a40 0%, #495057 100%);
      transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .black-section.winning {
      background: linear-gradient(180deg, #1a1a1a 0%, #2c2c2c 100%);
      box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.1);
    }
  `]
})
export class WinProbabilityComponent {
  @Input() evaluation: number = 0;
  @Input() barWidth: number = 24;
  @Input() barHeight: number = 200;
  
  Math = Math;
  
  get whitePercentage(): number {
    return this.centipawnToProbability(this.evaluation);
  }
  
  get blackPercentage(): number {
    return 100 - this.whitePercentage;
  }
  
  private centipawnToProbability(centipawns: number): number {
    if (Math.abs(centipawns) > 1000) {
      return centipawns > 0 ? 95 : 5;
    }
    
    const probability = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
    return Math.max(5, Math.min(95, probability));
  }
}
