import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { SiteData } from '../../core/site.models';
import { PublicSite } from '../../public-site/public-site';
import { PREVIEW_SELECTORS } from './preview-site';
import { PreviewMessage, readPreviewMessage } from './preview-protocol';
import { PreviewTarget } from './setup-steps';

const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"]';

@Component({
  imports: [PublicSite],
  selector: 'app-preview-frame',
  template: `
    @if (site(); as data) {
      <app-public-site [site]="data" [preview]="true" />
    }
  `,
})
export class PreviewFramePage {
  protected readonly site = signal<SiteData | null>(null);
  private highlighted: Element | null = null;
  private pending = 0;
  private target: PreviewTarget = 'top';

  constructor() {
    const theme = inject(ThemeService);
    theme.setSurface('public');

    const onMessage = (event: MessageEvent) => {
      const message = readPreviewMessage(event, window.parent);
      if (message?.type === 'terraza-preview-data') {
        this.target = message.target;
        this.site.set(message.site);
        this.schedule();
      }
    };
    const block = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(INTERACTIVE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const blockSubmit = (event: Event) => event.preventDefault();

    window.addEventListener('message', onMessage);
    document.addEventListener('click', block, true);
    document.addEventListener('submit', blockSubmit, true);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', block, true);
      document.removeEventListener('submit', blockSubmit, true);
      this.clearHighlight();
      theme.setSurface('platform');
    });

    this.send({ type: 'terraza-preview-ready' });
  }

  private send(message: PreviewMessage): void {
    if (window.parent !== window) {
      window.parent.postMessage(message, location.origin);
    }
  }

  private schedule(): void {
    const ticket = ++this.pending;
    const run = () => {
      if (ticket === this.pending) {
        this.position();
      }
    };
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(run)) : setTimeout(run);
  }

  private position(): void {
    this.clearHighlight();
    const selector = PREVIEW_SELECTORS[this.target];
    const element = selector ? document.querySelector(selector) : null;
    this.send({ type: 'terraza-preview-section', missing: !!selector && !element });
    if (!element) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    element.classList.add('preview-highlight');
    this.highlighted = element;
    window.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 70), behavior: 'smooth' });
  }

  private clearHighlight(): void {
    this.highlighted?.classList.remove('preview-highlight');
    this.highlighted = null;
  }
}
