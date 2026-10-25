import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toProblem } from './api-error';

export type Role = 'OWNER' | 'EDITOR';

export interface Me {
  email: string;
  role: Role;
  tenant: { id: string; slug: string; name: string; published: boolean; logoUrl: string | null };
}

export type AuthState =
  | { status: 'initializing' }
  | { status: 'anonymous' }
  | { status: 'error' }
  | { status: 'authenticated'; user: Me };

const API = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AuthState>({ status: 'initializing' });
  private initialization?: Promise<void>;

  readonly state = this.current.asReadonly();
  readonly user = computed(() => {
    const state = this.current();
    return state.status === 'authenticated' ? state.user : null;
  });
  readonly isOwner = computed(() => this.user()?.role === 'OWNER');

  ensureInitialized(): Promise<void> {
    return (this.initialization ??= this.restore());
  }

  retry(): Promise<void> {
    this.current.set({ status: 'initializing' });
    return (this.initialization = this.restore());
  }

  ensureCsrf(): Promise<unknown> {
    return firstValueFrom(this.http.get(`${API}/csrf`));
  }

  async login(email: string, password: string): Promise<void> {
    await this.ensureCsrf();
    const body = new HttpParams().set('username', email.trim()).set('password', password);
    await firstValueFrom(this.http.post(`${API}/login`, body));
    const user = await firstValueFrom(this.http.get<Me>(`${API}/me`));
    this.current.set({ status: 'authenticated', user });
  }

  async logout(): Promise<void> {
    await this.ensureCsrf();
    try {
      await firstValueFrom(this.http.post(`${API}/logout`, null));
    } catch (error) {
      if (toProblem(error).status !== 401) {
        throw error;
      }
    }
    this.current.set({ status: 'anonymous' });
    this.ensureCsrf().catch(() => undefined);
  }

  expireSession(): void {
    if (this.current().status === 'authenticated') {
      this.current.set({ status: 'anonymous' });
    }
  }

  private async restore(): Promise<void> {
    try {
      await this.ensureCsrf();
      const user = await firstValueFrom(this.http.get<Me>(`${API}/me`));
      this.current.set({ status: 'authenticated', user });
    } catch (error) {
      this.current.set(toProblem(error).status === 401 ? { status: 'anonymous' } : { status: 'error' });
    }
  }
}
