import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { AccessCodeService } from '../../services/access-code.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-access-gate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  template: `
    <div class="access-gate" *ngIf="!hasAccess">
      <div class="gate-card">
        <div class="logo">♟️</div>
        <h1>ChessPulse</h1>
        <p class="subtitle">Enter access code to continue</p>
        
        <form (ngSubmit)="checkCode()" class="access-form">
          <div class="form-group">
            <input
              type="password"
              [(ngModel)]="inputCode"
              name="code"
              placeholder="Access code"
              class="code-input"
              [class.error]="error"
              (input)="error = ''"
              autofocus
            />
          </div>
          
          <button type="submit" class="btn-enter" [disabled]="loading || !inputCode">
            {{ loading ? 'Verifying...' : 'Enter' }}
          </button>
          
          <p class="error-message" *ngIf="error">{{ error }}</p>
        </form>
        
        <div class="info-box">
          <p class="info-title">🔒 Beta Access</p>
          <p class="info-text">This is a private beta. Contact the administrator for an access code.</p>
        </div>
      </div>
    </div>
    
    <router-outlet *ngIf="hasAccess"></router-outlet>
  `,
  styles: [`
    .access-gate {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      z-index: 9999;
    }
    
    .gate-card {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    
    .logo {
      font-size: 64px;
      margin-bottom: 16px;
      animation: float 3s ease-in-out infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    
    h1 {
      margin: 0 0 8px 0;
      font-size: 32px;
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .subtitle {
      margin: 0 0 32px 0;
      color: #666;
      font-size: 16px;
    }
    
    .access-form {
      margin-bottom: 24px;
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    .code-input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      font-family: monospace;
      letter-spacing: 2px;
      text-align: center;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    
    .code-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .code-input.error {
      border-color: #ef4444;
      animation: shake 0.5s;
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    
    .btn-enter {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .btn-enter:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
    
    .btn-enter:active:not(:disabled) {
      transform: translateY(0);
    }
    
    .btn-enter:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .error-message {
      margin: 12px 0 0 0;
      padding: 10px;
      background: #fee;
      color: #c33;
      border-radius: 8px;
      font-size: 14px;
    }
    
    .info-box {
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    }
    
    .info-title {
      margin: 0 0 8px 0;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }
    
    .info-text {
      margin: 0;
      color: #666;
      font-size: 13px;
      line-height: 1.5;
    }
  `]
})
export class AccessGateComponent {
  inputCode = '';
  loading = false;
  error = '';
  hasAccess = false;

  constructor(
    private accessCodeService: AccessCodeService,
    private http: HttpClient,
    private router: Router
  ) {
    // Check if user already has a valid code
    this.hasAccess = this.accessCodeService.hasCode();
    
    // If they have a code, verify it's still valid
    if (this.hasAccess) {
      this.verifyExistingCode();
    }
  }

  async verifyExistingCode() {
    try {
      // Try to make a simple API call to verify the code
      await this.http.get('http://localhost:3000/api/performance').toPromise();
    } catch (error: any) {
      if (error.status === 403) {
        // Code is invalid, clear it
        this.accessCodeService.clearCode();
        this.hasAccess = false;
      }
    }
  }

  async checkCode() {
    if (!this.inputCode || this.inputCode.trim().length === 0) {
      this.error = 'Please enter an access code';
      return;
    }

    this.loading = true;
    this.error = '';

    // Set the code temporarily
    this.accessCodeService.setCode(this.inputCode);

    try {
      // Verify the code by making a test API call
      await this.http.get('http://localhost:3000/api/performance').toPromise();
      
      // Code is valid!
      this.hasAccess = true;
      this.loading = false;
      
      // Navigate to dashboard
      this.router.navigate(['/']);
    } catch (error: any) {
      this.loading = false;
      
      if (error.status === 403) {
        this.error = 'Invalid access code';
        this.accessCodeService.clearCode();
      } else {
        this.error = 'Unable to verify code. Please try again.';
      }
    }
  }
}
