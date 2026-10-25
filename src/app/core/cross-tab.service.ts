import { Injectable } from '@angular/core';

export type CrossTabMessage = 'email-verified' | 'ack';

const CHANNEL = 'terraza-auth';
const STORAGE_KEY = 'terraza-auth-message';

@Injectable({ providedIn: 'root' })
export class CrossTab {
  send(message: CrossTabMessage): void {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(message);
      channel.close();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ message, at: Date.now() }));
    } catch {
      // sin almacenamiento no hay forma de avisar a otra pestaña
    }
  }

  listen(handler: (message: CrossTabMessage) => void): () => void {
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = event => handler(event.data as CrossTabMessage);
      return () => channel.close();
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }
      try {
        handler((JSON.parse(event.newValue) as { message: CrossTabMessage }).message);
      } catch {
        // mensaje ilegible: se ignora
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
}
