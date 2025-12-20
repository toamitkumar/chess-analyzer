import { Injectable, signal, effect } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ClerkUser {
  id: string;
  emailAddress: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  username: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ClerkService {
  private clerk: any = null;
  private initialized = signal<boolean>(false);

  // Signals for reactive state
  readonly user = signal<ClerkUser | null>(null);
  readonly isAuthenticated = signal<boolean>(false);
  readonly isLoading = signal<boolean>(true);

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Import Clerk class from @clerk/clerk-js
      const module = await import('@clerk/clerk-js');

      // Handle both ESM and CommonJS module formats
      const clerkModule = (module as any).default || module;
      const Clerk = clerkModule.Clerk;

      if (!Clerk) {
        throw new Error('Clerk class not found in module');
      }

      // Create and load Clerk instance
      this.clerk = new Clerk(environment.clerkPublishableKey);
      await this.clerk.load();

      this.initialized.set(true);
      this.updateAuthState();

      // Listen for auth changes
      if (this.clerk && typeof this.clerk.addListener === 'function') {
        this.clerk.addListener((state: any) => {
          this.updateAuthState();
        });
      }

      this.isLoading.set(false);
    } catch (error) {
      console.error('Failed to initialize Clerk:', error);
      this.isLoading.set(false);
    }
  }

  private updateAuthState(): void {
    if (!this.clerk) return;

    const session = this.clerk.session;
    const user = this.clerk.user;

    if (session && user) {
      this.isAuthenticated.set(true);
      this.user.set({
        id: user.id,
        emailAddress: user.primaryEmailAddress?.emailAddress || '',
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        username: user.username
      });
    } else {
      this.isAuthenticated.set(false);
      this.user.set(null);
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.clerk?.session) return null;

    try {
      return await this.clerk.session.getToken();
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (!this.clerk) return;

    try {
      await this.clerk.signOut();
      this.updateAuthState();
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  }

  openSignIn(options?: any): void {
    if (!this.clerk) return;
    this.clerk.openSignIn(options);
  }

  openSignUp(options?: any): void {
    if (!this.clerk) return;
    this.clerk.openSignUp(options);
  }

  openUserProfile(): void {
    if (!this.clerk) return;
    this.clerk.openUserProfile();
  }

  getClerkInstance(): any {
    return this.clerk;
  }

  isReady(): boolean {
    return this.initialized();
  }
}
