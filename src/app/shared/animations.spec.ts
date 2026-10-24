import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CountUpDirective } from './count-up.directive';
import { RevealDirective } from './reveal.directive';

@Component({
  imports: [RevealDirective, CountUpDirective],
  template: `<div class="reveal" id="r"></div><p id="n" [appCountUp]="14"></p>`,
})
class Host {}

class FakeObserver {
  static instances: FakeObserver[] = [];
  disconnected = false;
  constructor(public callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeObserver.instances.push(this);
  }
  observe(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  trigger(): void {
    this.callback([{ isIntersecting: true }]);
  }
}

describe('animations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    FakeObserver.instances = [];
  });

  it('should show revealed content and final counters at once when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#r')!.classList.contains('visible')).toBe(true);
    expect(root.querySelector('#n')!.textContent).toBe('14+');
  });

  it('should skip animations when the user prefers reduced motion', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#r')!.classList.contains('visible')).toBe(true);
    expect(root.querySelector('#n')!.textContent).toBe('14+');
    expect(FakeObserver.instances.length).toBe(0);
  });

  it('should reveal on intersection, count up, and clean up on destroy', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('#r')!.classList.contains('visible')).toBe(false);
    expect(root.querySelector('#n')!.textContent).toBe('0+');

    FakeObserver.instances.forEach(observer => observer.trigger());
    fixture.detectChanges();
    expect(root.querySelector('#r')!.classList.contains('visible')).toBe(true);

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(root.querySelector('#n')!.textContent).toBe('14+');

    fixture.destroy();
    expect(FakeObserver.instances.every(observer => observer.disconnected)).toBe(true);
  });
});
