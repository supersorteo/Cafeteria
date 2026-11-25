import { InjectionToken } from '@angular/core';

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const cached = loading.get(src);
  if (cached) {
    return cached;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error(`No se pudo cargar ${src}`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export const SDK_LOADER = new InjectionToken<(src: string) => Promise<void>>('sdk-loader', { factory: () => loadScript });

export const PAGE_REDIRECT = new InjectionToken<(url: string) => void>('page-redirect', {
  factory: () => (url: string) => window.location.assign(url),
});
