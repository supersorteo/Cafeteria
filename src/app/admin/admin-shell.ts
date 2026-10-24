import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NoticeService } from '../core/notice.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-admin-shell',
  template: `
    @switch (auth.state().status) {
      @case ('authenticated') {
        @if (auth.user(); as user) {
          <div class="min-h-screen flex flex-col md:flex-row">
            <aside class="md:w-64 md:min-h-screen text-white p-5 flex md:flex-col gap-4 md:gap-8 items-center md:items-stretch justify-between"
                   style="background:var(--plum)">
              <div>
                <p class="font-display text-xl font-black text-mango break-words">{{ user.tenant.name }}</p>
                <p class="mt-1 text-xs font-bold uppercase tracking-widest text-white/60">
                  {{ user.role === 'OWNER' ? 'Propietario' : 'Editor' }}
                </p>
              </div>
              <nav aria-label="Panel" class="flex md:flex-col gap-2 text-sm font-bold uppercase tracking-widest">
                <a routerLink="/admin" routerLinkActive="bg-white/15" [routerLinkActiveOptions]="{ exact: true }"
                   class="rounded-xl px-4 py-2.5 hover:bg-white/10 transition-colors">Resumen</a>
                <a routerLink="/admin/menu" routerLinkActive="bg-white/15"
                   class="rounded-xl px-4 py-2.5 hover:bg-white/10 transition-colors">Carta</a>
                <a routerLink="/admin/site" routerLinkActive="bg-white/15"
                   class="rounded-xl px-4 py-2.5 hover:bg-white/10 transition-colors">Mi sitio</a>
                <a [href]="'/' + user.tenant.slug" target="_blank" rel="noopener"
                   class="rounded-xl px-4 py-2.5 hover:bg-white/10 transition-colors">Ver mi sitio ↗</a>
              </nav>
              <div class="md:mt-auto text-sm">
                <p class="hidden md:block text-white/70 break-all mb-3">{{ user.email }}</p>
                <button type="button" (click)="logout()" [disabled]="loggingOut()"
                        class="w-full rounded-xl border border-white/30 px-4 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-colors disabled:opacity-60">
                  {{ loggingOut() ? 'Saliendo…' : 'Cerrar sesión' }}
                </button>
              </div>
            </aside>
            <main class="flex-1 p-6 md:p-10">
              <router-outlet />
            </main>
          </div>
        }
      }
      @case ('error') {
        <main class="min-h-screen flex items-center justify-center px-5 text-center">
          <div class="max-w-md">
            <h1 class="font-display text-3xl font-black" style="color:var(--plum)">No pudimos verificar tu sesión</h1>
            <p class="mt-4 font-medium" style="color:#5b4150">
              Es un problema de conexión; tu sesión no se cerró. Inténtalo de nuevo.
            </p>
            <button type="button" (click)="retry()"
                    class="mt-8 bg-coral text-white font-bold px-8 py-3.5 rounded-full uppercase tracking-widest text-sm hover:brightness-110 transition-all">
              Reintentar
            </button>
          </div>
        </main>
      }
      @default {
        <main class="min-h-screen flex items-center justify-center" role="status" aria-busy="true">
          <p class="font-display text-2xl font-black text-coral">Cargando…</p>
        </main>
      }
    }
  `,
})
export class AdminShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notices = inject(NoticeService);

  protected readonly loggingOut = signal(false);

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
