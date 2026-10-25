import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CrossTab, CrossTabMessage } from './cross-tab.service';

describe('CrossTab', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should deliver a message to another channel with the same name and stop after cleanup', async () => {
    const service = TestBed.inject(CrossTab);
    const received: CrossTabMessage[] = [];
    const stop = service.listen(message => received.push(message));

    service.send('email-verified');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(received).toEqual(['email-verified']);

    stop();
    service.send('ack');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(received).toEqual(['email-verified']);
  });

  it('should fall back to the storage event when BroadcastChannel is not available', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const service = TestBed.inject(CrossTab);
    const received: CrossTabMessage[] = [];
    const stop = service.listen(message => received.push(message));

    service.send('email-verified');
    const stored = localStorage.getItem('terraza-auth-message');
    expect(stored).toContain('email-verified');
    window.dispatchEvent(new StorageEvent('storage', { key: 'terraza-auth-message', newValue: stored }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave', newValue: stored }));
    expect(received).toEqual(['email-verified']);
    stop();
    localStorage.removeItem('terraza-auth-message');
  });
});
