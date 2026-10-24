import { Component, inject } from '@angular/core';
import { NoticeService } from '../core/notice.service';

@Component({
  selector: 'app-notice-banner',
  template: `
    @if (notices.notice(); as notice) {
      <div class="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <div [attr.role]="notice.kind === 'error' ? 'alert' : 'status'"
             class="pointer-events-auto max-w-md w-full flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl text-sm font-bold text-white"
             [style.background]="notice.kind === 'error' ? '#E63946' : 'var(--plum)'">
          <span class="flex-1">{{ notice.text }}</span>
          <button type="button" (click)="notices.dismiss()" aria-label="Cerrar aviso" class="text-white/80 hover:text-white">✕</button>
        </div>
      </div>
    }
  `,
})
export class NoticeBanner {
  protected readonly notices = inject(NoticeService);
}
