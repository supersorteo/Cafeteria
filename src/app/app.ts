import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SuperAdminAuth } from './core/superadmin-auth.service';
import { ThemeService } from './core/theme.service';
import { NoticeBanner } from './shared/notice-banner';
import { Modal } from './shared/ui/modal';
import { SuperAdminLoginForm } from './superadmin/superadmin-login-form';

@Component({
  imports: [RouterOutlet, NoticeBanner, Modal, SuperAdminLoginForm],
  selector: 'app-root',
  template: `
    <app-notice-banner /><router-outlet />
    @if (superAdminOpen()) {
      @defer (on immediate) {
        <app-modal heading="Acceso restringido" size="sm" (closed)="closeSuperAdmin()">
          <app-superadmin-login-form (authenticated)="enterSuperAdmin()" />
        </app-modal>
      }
    }
  `,
})
export class App {
  private readonly superAdmin = inject(SuperAdminAuth);
  private readonly router = inject(Router);

  protected readonly superAdminOpen = signal(false);

  constructor() {
    inject(ThemeService);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.code === 'KeyP' && event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      void this.openSuperAdmin();
    }
  }

  protected closeSuperAdmin(): void {
    this.superAdminOpen.set(false);
    this.superAdmin.backToCredentials();
  }

  protected enterSuperAdmin(): void {
    this.superAdminOpen.set(false);
    void this.router.navigateByUrl('/superadmin');
  }

  private async openSuperAdmin(): Promise<void> {
    if (this.superAdminOpen() || this.router.url.startsWith('/superadmin/login')) {
      return;
    }
    await this.superAdmin.ensureInitialized();
    if (this.superAdmin.state() === 'authenticated') {
      await this.router.navigateByUrl('/superadmin');
    } else {
      this.superAdminOpen.set(true);
    }
  }
}
