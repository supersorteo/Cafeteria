import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export function safeReturnUrl(url: string | null | undefined): string {
  return url && /^\/admin(?:[/?#]|$)/.test(url) ? url : '/admin';
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureInitialized();
  return auth.state().status === 'anonymous'
    ? router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } })
    : true;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureInitialized();
  return auth.state().status === 'authenticated' ? router.createUrlTree(['/admin']) : true;
};
