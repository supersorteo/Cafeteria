import { HttpErrorResponse } from '@angular/common/http';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiProblem {
  status: number;
  code: string | null;
  fieldErrors: FieldError[];
  retryAfter: number | null;
}

export function toProblem(error: unknown): ApiProblem {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: null, fieldErrors: [], retryAfter: null };
  }
  const body = error.error as { code?: unknown; fieldErrors?: unknown } | null;
  return {
    status: error.status,
    code: typeof body?.code === 'string' ? body.code : null,
    fieldErrors: Array.isArray(body?.fieldErrors) ? (body.fieldErrors as FieldError[]) : [],
    retryAfter: Number(error.headers?.get('Retry-After')) || null,
  };
}

export function isConnectionProblem(problem: ApiProblem): boolean {
  return problem.status === 0 || problem.status >= 500;
}
