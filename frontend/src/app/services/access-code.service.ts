import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccessCodeService {
  private codeSubject = new BehaviorSubject<string | null>(null);
  public code$ = this.codeSubject.asObservable();
  
  private readonly STORAGE_KEY = 'chess-access-code';

  constructor() {
    // Load code from localStorage on init
    const savedCode = localStorage.getItem(this.STORAGE_KEY);
    if (savedCode) {
      this.codeSubject.next(savedCode);
    }
  }

  setCode(code: string): void {
    this.codeSubject.next(code);
    localStorage.setItem(this.STORAGE_KEY, code);
  }

  getCode(): string | null {
    return this.codeSubject.value;
  }

  hasCode(): boolean {
    return !!this.getCode();
  }

  clearCode(): void {
    this.codeSubject.next(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
