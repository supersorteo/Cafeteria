import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type SuperAdminState = 'initializing' | 'anonymous' | 'authenticated';
export type SuperAdminStep = 'credentials' | 'code';

interface LoginResponse {
  step: string;
  maskedEmail: string;
  expiresInSeconds: number;
}

const API = '/api/v1/superadmin/auth';

@Injectable({ providedIn: 'root' })
export class SuperAdminAuth {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private initialization?: Promise<void>;

  readonly state = signal<SuperAdminState>('initializing');
  readonly email = signal<string | null>(null);
  readonly step = signal<SuperAdminStep>('credentials');
  readonly maskedEmail = signal('');
  readonly codeExpiresAt = signal(0);

  ensureInitialized(): Promise<void> {
    return (this.initialization ??= this.restore());
  }

  async login(email: string, password: string): Promise<void> {
    await this.auth.ensureCsrf();
    const response = await firstValueFrom(this.http.post<LoginResponse>(`${API}/login`, { email: email.trim(), password }));
    this.maskedEmail.set(response.maskedEmail);
    this.codeExpiresAt.set(Date.now() + response.expiresInSeconds * 1000);
    this.step.set('code');
  }

  async verify(code: string): Promise<void> {
    await this.auth.ensureCsrf();
    await firstValueFrom(this.http.post(`${API}/verify`, { code: code.trim() }));
    const me = await firstValueFrom(this.http.get<{ email: string }>(`${API}/me`));
    this.email.set(me.email);
    this.state.set('authenticated');
    this.step.set('credentials');
  }

  backToCredentials(): void {
    this.step.set('credentials');
  }

  async logout(): Promise<void> {
    try {
      await this.auth.ensureCsrf();
      await firstValueFrom(this.http.post(`${API}/logout`, null));
    } catch {
      // la sesión del servidor caduca sola; en el navegador se cierra igual
    }
    this.expire();
    this.auth.ensureCsrf().catch(() => undefined);
  }

  expire(): void {
    this.email.set(null);
    this.step.set('credentials');
    this.state.set('anonymous');
  }

  private async restore(): Promise<void> {
    try {
      await this.auth.ensureCsrf();
      const me = await firstValueFrom(this.http.get<{ email: string }>(`${API}/me`));
      this.email.set(me.email);
      this.state.set('authenticated');
    } catch {
      this.state.set('anonymous');
    }
  }
}
