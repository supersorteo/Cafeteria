import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SuperAdminAuth } from './superadmin-auth.service';

export const superAdminGuard: CanActivateFn = async () => {
  const auth = inject(SuperAdminAuth);
  const router = inject(Router);
  await auth.ensureInitialized();
  return auth.state() === 'authenticated' ? true : router.createUrlTree(['/superadmin/login']);
};

export const superAdminGuestGuard: CanActivateFn = async () => {
  const auth = inject(SuperAdminAuth);
  const router = inject(Router);
  await auth.ensureInitialized();
  return auth.state() === 'authenticated' ? router.createUrlTree(['/superadmin']) : true;
};
