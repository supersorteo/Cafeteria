import { Component, inject } from '@angular/core';
import { NoticeService } from '../core/notice.service';

@Component({
  selector: 'app-notice-banner',
  template: `
    @if (notices.notice(); as notice) {
      <div class="fixed top-4 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
        <div [attr.role]="notice.kind === 'error' ? 'alert' : 'status'"
             class="toast pointer-events-auto max-w-md w-full flex items-start gap-3 rounded-ui-lg px-4 py-3.5 text-sm font-semibold shadow-lift"
             [class.toast-error]="notice.kind === 'error'">
          <svg class="shrink-0 mt-0.5" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (notice.kind === 'error') {
              <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>
            } @else {
              <circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>
            }
          </svg>
          <span class="flex-1">{{ notice.text }}</span>
          <button type="button" (click)="notices.dismiss()" aria-label="Cerrar aviso" class="shrink-0 -m-1 p-1 rounded-full opacity-70 hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class NoticeBanner {
  protected readonly notices = inject(NoticeService);
}
