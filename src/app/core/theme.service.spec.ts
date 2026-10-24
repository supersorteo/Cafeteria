import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_MODE, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute('data-surface');
  });

  it('should apply the default mode, the editorial preset and the platform surface', () => {
    TestBed.inject(ThemeService);
    expect(root.getAttribute('data-theme')).toBe(DEFAULT_MODE);
    expect(root.getAttribute('data-ui')).toBe('editorial');
    expect(root.getAttribute('data-surface')).toBe('platform');
  });

  it('should persist and reapply the chosen mode and preset', () => {
    const service = TestBed.inject(ThemeService);
    service.setMode('dark');
    service.setPreset('saas');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-ui')).toBe('saas');
    expect(localStorage.getItem('ui.theme')).toBe('dark');
    expect(localStorage.getItem('ui.preset')).toBe('saas');
  });

  it('should restore a stored preference and ignore invalid values', () => {
    localStorage.setItem('ui.theme', 'system');
    localStorage.setItem('ui.preset', 'neon');
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('system');
    expect(service.preset()).toBe('editorial');
  });

  it('should switch the surface for public pages', () => {
    const service = TestBed.inject(ThemeService);
    service.setSurface('public');
    expect(root.getAttribute('data-surface')).toBe('public');
    service.setSurface('platform');
    expect(root.getAttribute('data-surface')).toBe('platform');
  });
});
