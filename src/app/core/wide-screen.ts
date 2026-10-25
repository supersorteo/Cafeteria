import { DestroyRef, Signal, inject, signal } from '@angular/core';

export function wideScreen(query = '(min-width: 1280px)'): Signal<boolean> {
  const supported = typeof matchMedia === 'function';
  const media = supported ? matchMedia(query) : null;
  const wide = signal(media?.matches ?? false);
  if (media) {
    const listener = (event: MediaQueryListEvent) => wide.set(event.matches);
    media.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
  }
  return wide.asReadonly();
}
