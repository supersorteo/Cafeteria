import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type UiPreset = 'editorial' | 'saas';
type Surface = 'platform' | 'public';

const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];
const PRESETS: readonly UiPreset[] = ['editorial', 'saas'];
const MODE_KEY = 'ui.theme';
const PRESET_KEY = 'ui.preset';

export const DEFAULT_MODE: ThemeMode = 'system';

function read<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = localStorage.getItem(key);
    return allowed.find(item => item === value) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // almacenamiento no disponible: la preferencia solo dura la sesión
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private fadeTimer?: ReturnType<typeof setTimeout>;
  private readonly currentMode = signal<ThemeMode>(read(MODE_KEY, MODES) ?? DEFAULT_MODE);
  private readonly currentPreset = signal<UiPreset>(read(PRESET_KEY, PRESETS) ?? 'editorial');

  readonly mode = this.currentMode.asReadonly();
  readonly preset = this.currentPreset.asReadonly();

  constructor() {
    this.apply();
  }

  setMode(mode: ThemeMode): void {
    this.currentMode.set(mode);
    write(MODE_KEY, mode);
    this.apply(true);
  }

  setPreset(preset: UiPreset): void {
    this.currentPreset.set(preset);
    write(PRESET_KEY, preset);
    this.apply(true);
  }

  setSurface(surface: Surface): void {
    this.root.setAttribute('data-surface', surface);
  }

  private apply(animate = false): void {
    if (animate) {
      clearTimeout(this.fadeTimer);
      this.root.classList.add('theme-fade');
      this.fadeTimer = setTimeout(() => this.root.classList.remove('theme-fade'), 400);
    }
    this.root.setAttribute('data-theme', this.currentMode());
    this.root.setAttribute('data-ui', this.currentPreset());
    if (!this.root.hasAttribute('data-surface')) {
      this.setSurface('platform');
    }
  }
}
