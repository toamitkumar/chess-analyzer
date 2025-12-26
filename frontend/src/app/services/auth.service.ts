import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment.development';

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  chessUsername?: string;
  displayName?: string;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUser = signal<AuthUser | null>(null);
  private currentSession = signal<Session | null>(null);

  // Public read-only signals
  user = this.currentUser.asReadonly();
  session = this.currentSession.asReadonly();
  isAuthenticated = computed(() => this.currentUser() !== null);
  isLoading = signal<boolean>(true);

  constructor(private router: Router) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Increase lock timeout to prevent Navigator lock errors
          storageKey: 'sb-auth-token',
          flowType: 'pkce'
        }
      }
    );

    // Initialize auth state
    this.initializeAuth();

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      this.currentSession.set(session);

      if (session?.user) {
        this.currentUser.set(this.mapSupabaseUser(session.user));
      } else {
        this.currentUser.set(null);
      }
    });
  }

  private async initializeAuth() {
    let retries = 3;
    while (retries > 0) {
      try {
        const { data: { session }, error } = await this.supabase.auth.getSession();

        if (error) {
          // Check if it's a lock error
          if (error.message?.includes('lock') && retries > 1) {
            console.warn(`Lock acquisition failed, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            retries--;
            continue;
          }
          throw error;
        }

        this.currentSession.set(session);

        if (session?.user) {
          this.currentUser.set(this.mapSupabaseUser(session.user));
        }

        break; // Success, exit retry loop
      } catch (error: any) {
        console.error('Failed to initialize auth:', error);
        if (retries === 1) {
          // Last retry failed, set as not loading anyway to unblock UI
          console.error('Auth initialization failed after all retries');
        }
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    this.isLoading.set(false);
  }

  private mapSupabaseUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email || '',
      username: user.user_metadata?.['username'],
      chessUsername: user.user_metadata?.['chess_username'],
      displayName: user.user_metadata?.['display_name'] ||
                   user.user_metadata?.['full_name'] ||
                   user.email?.split('@')[0] ||
                   'User',
      avatarUrl: user.user_metadata?.['avatar_url']
    };
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, metadata?: {
    username?: string;
    chessUsername?: string;
    displayName?: string;
  }) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: metadata?.username,
            chess_username: metadata?.chessUsername,
            full_name: metadata?.displayName,
            display_name: metadata?.displayName
          }
        }
      });

      if (error) throw error;

      return { success: true, user: data.user, needsEmailConfirmation: !data.session };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign up',
        user: null,
        needsEmailConfirmation: false
      };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentSession.set(data.session);
      if (data.user) {
        this.currentUser.set(this.mapSupabaseUser(data.user));
      }

      return { success: true, user: data.user };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign in',
        user: null
      };
    }
  }

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   */
  async signInWithProvider(provider: 'google' | 'github' | 'apple') {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('OAuth sign in error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign in with provider'
      };
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) throw error;

      this.currentSession.set(null);
      this.currentUser.set(null);

      // Redirect to login page
      this.router.navigate(['/auth/login']);

      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign out'
      };
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send reset email'
      };
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Password update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update password'
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: {
    username?: string;
    chessUsername?: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    try {
      const { error } = await this.supabase.auth.updateUser({
        data: {
          username: updates.username,
          chess_username: updates.chessUsername,
          display_name: updates.displayName,
          avatar_url: updates.avatarUrl
        }
      });

      if (error) throw error;

      // Update local user state
      const currentUserValue = this.currentUser();
      if (currentUserValue) {
        this.currentUser.set({
          ...currentUserValue,
          username: updates.username || currentUserValue.username,
          chessUsername: updates.chessUsername || currentUserValue.chessUsername,
          displayName: updates.displayName || currentUserValue.displayName,
          avatarUrl: updates.avatarUrl || currentUserValue.avatarUrl
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Profile update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update profile'
      };
    }
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    const session = this.currentSession();
    return session?.access_token || null;
  }

  /**
   * Refresh session
   */
  async refreshSession() {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) throw error;

      this.currentSession.set(data.session);

      return { success: true, session: data.session };
    } catch (error: any) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: error.message || 'Failed to refresh session'
      };
    }
  }
}
