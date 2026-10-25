import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { SuperAdminLoginForm } from './superadmin-login-form';

@Component({
  imports: [SuperAdminLoginForm, ThemeToggle],
  selector: 'app-superadmin-login-page',
  template: `
    <main class="relative min-h-screen bg-app flex items-center justify-center px-5 py-10">
      <div class="absolute top-4 right-4"><app-theme-toggle /></div>
      <div class="w-full max-w-md anim-fade-up">
        <div class="card p-6 md:p-9 !rounded-ui-xl">
          <div class="w-12 h-12 rounded-ui-lg bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h1 class="mt-5 font-display text-3xl font-black">Acceso restringido</h1>
          <p class="mt-2 font-medium text-muted">Panel de administración de la plataforma.</p>
          <div class="mt-7"><app-superadmin-login-form (authenticated)="open()" /></div>
        </div>
      </div>
    </main>
  `,
})
export class SuperAdminLoginPage {
  private readonly router = inject(Router);

  protected open(): void {
    void this.router.navigateByUrl('/superadmin');
  }
}
