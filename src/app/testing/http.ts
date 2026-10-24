import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Me } from '../core/auth.service';

export const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

export const CSRF = '/api/v1/auth/csrf';
export const ME_URL = '/api/v1/auth/me';

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    email: 'owner@a.test',
    role: 'OWNER',
    tenant: { id: 't1', slug: 'negocio-a', name: 'Negocio A', published: true },
    ...overrides,
  };
}

interface Init {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}

export async function answer(
  http: HttpTestingController,
  url: string,
  body: object | string | null = null,
  init: Init = {},
  method?: string,
): Promise<TestRequest> {
  const matches = (r: { url: string; method: string }) => r.url === url && (method === undefined || r.method === method);
  let request: TestRequest | undefined;
  for (let attempt = 0; !request; attempt++) {
    await settle();
    try {
      request = http.expectOne(matches, `${method ?? ''} ${url}`);
    } catch (error) {
      if (attempt >= 40) {
        throw error;
      }
    }
  }
  request.flush(body, { status: init.status ?? 200, statusText: init.statusText ?? 'OK', headers: init.headers });
  return request;
}

export async function answerCsrf(http: HttpTestingController): Promise<void> {
  await answer(http, CSRF, { headerName: 'X-XSRF-TOKEN' });
}

export async function restoreSession(http: HttpTestingController, me: Me | null): Promise<void> {
  await answerCsrf(http);
  if (me) {
    await answer(http, ME_URL, me);
  } else {
    await answer(http, ME_URL, { code: 'unauthenticated' }, { status: 401, statusText: 'Unauthorized' });
  }
}

export async function fail(http: HttpTestingController, url: string, status: number, body: object | string | null = {}, headers?: Record<string, string>): Promise<void> {
  await answer(http, url, body, { status, statusText: 'Error', headers });
}

export function type(root: HTMLElement, selector: string, value: string): void {
  const field = root.querySelector(selector) as HTMLInputElement | null;
  if (!field) {
    throw new Error(`No existe ${selector}`);
  }
  field.value = value;
  field.dispatchEvent(new Event('input'));
  field.dispatchEvent(new Event('change'));
}

export function submit(root: HTMLElement): void {
  (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
}

export async function answerMatching(
  http: HttpTestingController,
  predicate: (request: { url: string; method: string; params: { get(name: string): string | null } }) => boolean,
  label: string,
  body: object | string | null = null,
  init: Init = {},
): Promise<TestRequest> {
  let request: TestRequest | undefined;
  for (let attempt = 0; !request; attempt++) {
    await settle();
    try {
      request = http.expectOne(predicate, label);
    } catch (error) {
      if (attempt >= 40) {
        throw error;
      }
    }
  }
  request.flush(body, { status: init.status ?? 200, statusText: init.statusText ?? 'OK', headers: init.headers });
  return request;
}
