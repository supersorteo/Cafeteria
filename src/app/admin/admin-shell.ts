import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';
import { Modal } from '../shared/ui/modal';
import { StatusScreen } from '../shared/ui/status-screen';
import { ThemeToggle } from '../shared/ui/theme-toggle';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Modal, ThemeToggle, StatusScreen],
  selector: 'app-admin-shell',
  template: `
    @switch (auth.state().status) {
      @case ('authenticated') {
        @if (auth.user(); as user) {
          <div class="min-h-screen bg-app md:flex">
            <aside class="side hidden md:flex flex-col sticky top-0 h-screen shrink-0 text-white p-4 gap-6" [class.side-collapsed]="collapsed()">
              <div class="flex items-center gap-3 min-h-12">
                <span class="side-logo" aria-hidden="true">{{ user.tenant.name.charAt(0).toUpperCase() }}</span>
                <div class="side-text min-w-0">
                  <p class="font-display text-lg font-black text-gold leading-tight break-words">{{ user.tenant.name }}</p>
                  <p class="mt-0.5 text-[.65rem] font-bold uppercase tracking-widest text-white/60">{{ user.role === 'OWNER' ? 'Propietario' : 'Editor' }}</p>
                </div>
              </div>

              <nav aria-label="Panel" class="flex flex-col gap-1">
                <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link" [attr.title]="collapsed() ? 'Resumen' : null">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                  <span class="side-text">Resumen</span></a>
                <a routerLink="/admin/menu" routerLinkActive="active" class="nav-link" [attr.title]="collapsed() ? 'Carta' : null">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M8 9h7M8 13h7"/></svg>
                  <span class="side-text">Carta</span></a>
                <a routerLink="/admin/site" routerLinkActive="active" class="nav-link" [attr.title]="collapsed() ? 'Mi sitio' : null">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                  <span class="side-text">Mi sitio</span></a>
                <a [href]="'/' + user.tenant.slug" target="_blank" rel="noopener" class="nav-link" [attr.title]="collapsed() ? 'Ver mi sitio' : null">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
                  <span class="side-text">Ver mi sitio ↗</span></a>
              </nav>

              <div class="mt-auto space-y-3">
                <p class="side-text text-xs text-white/70 break-all">{{ user.email }}</p>
                <button type="button" (click)="logout()" [disabled]="loggingOut()" class="side-btn" [attr.title]="collapsed() ? 'Cerrar sesión' : null">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>
                  <span class="side-text">{{ loggingOut() ? 'Saliendo…' : 'Cerrar sesión' }}</span>
                </button>
                <button type="button" class="side-btn" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed() ? 'Expandir menú' : 'Contraer menú'" [attr.aria-expanded]="!collapsed()">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [class.rotate-180]="collapsed()"><path d="M15 6l-6 6 6 6"/></svg>
                  <span class="side-text">Contraer</span>
                </button>
              </div>
            </aside>

            <div class="flex-1 min-w-0 flex flex-col">
              <header class="topbar glass sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-8 py-2.5 !border-x-0 !border-t-0">
                <p class="md:hidden font-display text-lg font-black truncate">{{ user.tenant.name }}</p>
                <span class="hidden md:block"></span>
                <div class="flex items-center gap-1">
                  <a [href]="'/' + user.tenant.slug" target="_blank" rel="noopener" class="btn btn-secondary btn-sm hidden sm:inline-flex">Ver mi sitio ↗</a>
                  <app-theme-toggle />
                </div>
              </header>
              <main class="flex-1 p-4 sm:p-6 md:p-10 pb-28 md:pb-10">
                <router-outlet />
              </main>
            </div>

            <div role="navigation" aria-label="Panel (móvil)" class="tabbar md:hidden fixed bottom-0 inset-x-0 z-40 glass !border-x-0 !border-b-0">
              <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="tab-item">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                <span>Resumen</span></a>
              <a routerLink="/admin/menu" routerLinkActive="active" class="tab-item">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M8 9h7M8 13h7"/></svg>
                <span>Carta</span></a>
              <a routerLink="/admin/site" routerLinkActive="active" class="tab-item">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                <span>Mi sitio</span></a>
              <button type="button" class="tab-item" (click)="accountOpen.set(true)" aria-haspopup="dialog">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                <span>Cuenta</span></button>
            </div>

            @if (accountOpen()) {
              <app-modal heading="Tu cuenta" size="sm" (closed)="accountOpen.set(false)">
                <p class="font-bold">{{ user.tenant.name }}</p>
                <p class="text-sm text-muted break-all">{{ user.email }}</p>
                <span class="badge mt-2">{{ user.role === 'OWNER' ? 'Propietario' : 'Editor' }}</span>
                <a [href]="'/' + user.tenant.slug" target="_blank" rel="noopener" class="btn btn-secondary w-full mt-5">Ver mi sitio ↗</a>
                <div modal-footer>
                  <button type="button" class="btn btn-danger w-full" (click)="logout()" [disabled]="loggingOut()">{{ loggingOut() ? 'Saliendo…' : 'Cerrar sesión' }}</button>
                </div>
              </app-modal>
            }
          </div>
        }
      }
      @case ('error') {
        <app-status-screen kind="error" title="No pudimos verificar tu sesión" message="Es un problema de conexión; tu sesión no se cerró. Inténtalo de nuevo.">
          <button type="button" (click)="retry()" class="btn btn-primary btn-lg">Reintentar</button>
        </app-status-screen>
      }
      @default {
        <app-status-screen kind="loading" title="Cargando…" />
      }
    }
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notices = inject(NoticeService);

  protected readonly loggingOut = signal(false);
  protected readonly collapsed = signal(false);
  protected readonly accountOpen = signal(false);

  protected async logout(): Promise<void> {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
      await this.router.navigate(['/auth/login']);
    } catch {
      this.notices.show('error', 'No pudimos cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      this.loggingOut.set(false);
    }
  }

  protected retry(): void {
    void this.auth.retry();
  }
}
