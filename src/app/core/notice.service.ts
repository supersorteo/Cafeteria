import { Injectable, signal } from '@angular/core';

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly current = signal<Notice | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  readonly notice = this.current.asReadonly();

  show(kind: Notice['kind'], text: string, durationMs = 7000): void {
    clearTimeout(this.timer);
    this.current.set({ kind, text });
    if (durationMs > 0) {
      this.timer = setTimeout(() => this.current.set(null), durationMs);
    }
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}
