import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, PlanStatus } from './auth.service';

export interface PlanInfo {
  expiresAt: string | null;
  status: PlanStatus;
}

export const PLAN_WARNING_DAYS = 7;

export function formatActivationCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^DLR/, '').slice(0, 8);
  const body = compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
  return compact ? `DLR-${body}` : '';
}

export function daysLeft(expiresAt: string | null, now = Date.now()): number | null {
  return expiresAt === null ? null : Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000);
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly renewalOpen = signal(false);

  openRenewal(): void {
    this.renewalOpen.set(true);
  }

  closeRenewal(): void {
    this.renewalOpen.set(false);
  }

  async redeem(code: string): Promise<PlanInfo> {
    await this.auth.ensureCsrf();
    const plan = await firstValueFrom(this.http.post<PlanInfo>('/api/v1/admin/plan/redeem', { code }));
    await this.auth.refreshUser();
    return plan;
  }
}
