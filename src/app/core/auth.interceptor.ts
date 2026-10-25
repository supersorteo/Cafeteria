import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { toProblem } from './api-error';
import { AuthService } from './auth.service';
import { SuperAdminAuth } from './superadmin-auth.service';
import { NoticeService } from './notice.service';

const AUTH_API = '/api/v1/auth/';
const SUPERADMIN_API = '/api/v1/superadmin/';
const SUPERADMIN_AUTH_API = '/api/v1/superadmin/auth/';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const superAdmin = inject(SuperAdminAuth);
  const router = inject(Router);
  const notice = inject(NoticeService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && request.url.startsWith(SUPERADMIN_API)) {
        if (error.status === 401 && !request.url.startsWith(SUPERADMIN_AUTH_API) && superAdmin.state() === 'authenticated') {
          superAdmin.expire();
          notice.show('info', 'Tu sesión expiró. Vuelve a identificarte.');
          void router.navigate(['/superadmin/login']);
        }
        return throwError(() => error);
      }
      if (error instanceof HttpErrorResponse && request.url.startsWith('/api/') && !request.url.startsWith(AUTH_API)) {
        const problem = toProblem(error);

        if (problem.status === 401 && auth.state().status === 'authenticated') {
          const returnUrl = router.url;
          auth.expireSession();
          notice.show('info', 'Tu sesión expiró. Inicia sesión de nuevo.');
          void router.navigate(['/auth/login'], { queryParams: { returnUrl } });
        } else if (problem.status === 403) {
          if (problem.code === 'csrf_invalid') {
            auth.ensureCsrf().catch(() => undefined);
            notice.show('error', 'La verificación de seguridad expiró. Vuelve a intentarlo.');
          } else {
            notice.show('error', 'No tienes permiso para realizar esta acción.');
          }
        }
      }
      return throwError(() => error);
    }),
  );
};
