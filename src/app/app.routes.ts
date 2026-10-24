import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { NotFound } from './not-found/not-found';
import { PublicSitePage } from './public-site/public-site.page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
  },
  {
    path: 'auth',
    children: [
      { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./auth/login.page').then(m => m.LoginPage) },
      { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./auth/register.page').then(m => m.RegisterPage) },
      { path: 'verify-email', loadComponent: () => import('./auth/verify-email.page').then(m => m.VerifyEmailPage) },
      {
        path: 'forgot-password',
        data: { mode: 'forgot' },
        loadComponent: () => import('./auth/email-form.page').then(m => m.EmailFormPage),
      },
      {
        path: 'resend-verification',
        data: { mode: 'resend' },
        loadComponent: () => import('./auth/email-form.page').then(m => m.EmailFormPage),
      },
      { path: 'reset-password', loadComponent: () => import('./auth/reset-password.page').then(m => m.ResetPasswordPage) },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: '**', component: NotFound },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/admin-shell').then(m => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./admin/dashboard.page').then(m => m.DashboardPage) },
      { path: 'menu', loadComponent: () => import('./admin/menu/menu.page').then(m => m.MenuPage) },
      {
        path: 'site',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./admin/site/site.page').then(m => m.SitePage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
  { path: ':slug', component: PublicSitePage },
  { path: '**', component: NotFound },
];
