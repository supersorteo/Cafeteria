import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type SuperAdminState = 'initializing' | 'anonymous' | 'authenticated';
export type SuperAdminStep = 'credentials' | 'code';
export type SuperAdminRole = 'ADMIN' | 'OPERATOR';

interface MeResponse {
  email: string;
  role?: SuperAdminRole;
  regions?: string[];
  mustChangePassword?: boolean;
  canChangePassword?: boolean;
}

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
  readonly role = signal<SuperAdminRole>('ADMIN');
  readonly regions = signal<string[]>([]);
  readonly mustChangePassword = signal(false);
  readonly canChangePassword = signal(false);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');
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
    this.applyMe(await firstValueFrom(this.http.get<MeResponse>(`${API}/me`)));
    this.state.set('authenticated');
    this.step.set('credentials');
  }

  async changePassword(current: string, next: string): Promise<void> {
    await this.auth.ensureCsrf();
    await firstValueFrom(this.http.post(`${API}/password`, { current, next }));
    this.mustChangePassword.set(false);
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
    this.role.set('ADMIN');
    this.regions.set([]);
    this.mustChangePassword.set(false);
    this.canChangePassword.set(false);
    this.step.set('credentials');
    this.state.set('anonymous');
  }

  private async restore(): Promise<void> {
    try {
      await this.auth.ensureCsrf();
      this.applyMe(await firstValueFrom(this.http.get<MeResponse>(`${API}/me`)));
      this.state.set('authenticated');
    } catch {
      this.state.set('anonymous');
    }
  }

  private applyMe(me: MeResponse): void {
    this.email.set(me.email);
    this.role.set(me.role ?? 'ADMIN');
    this.regions.set(me.regions ?? []);
    this.mustChangePassword.set(!!me.mustChangePassword);
    this.canChangePassword.set(!!me.canChangePassword);
  }
}
