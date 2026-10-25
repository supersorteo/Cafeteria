import { Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom, startWith } from 'rxjs';
import { CatalogApi } from '../../core/catalog.api';
import { SiteCategory } from '../../core/site.models';
import { buildPreviewSite } from './preview-site';
import { PREVIEW_PATH, PreviewMessage, readPreviewMessage } from './preview-protocol';
import { PreviewTarget } from './setup-steps';
import { SiteSettingsStore } from './site-settings.store';

const MENU_CATEGORIES = 4;
const MENU_ITEMS = 6;
export const PHONE_SCREEN = { width: 390, height: 780, bezel: 12 };
const PHONE_WIDTH = PHONE_SCREEN.width + PHONE_SCREEN.bezel * 2;
const PHONE_HEIGHT = PHONE_SCREEN.height + PHONE_SCREEN.bezel * 2;

@Component({
  selector: 'app-site-preview',
  host: { class: 'block' },
  template: `
    <div class="preview-label">
      <span class="preview-dot" aria-hidden="true"></span> Vista previa en vivo
    </div>
    <div class="phone-wrap" #wrap [style.height.px]="wrapHeight()">
      <div class="phone" [style.transform]="'scale(' + scale() + ')'">
        <span class="phone-notch" aria-hidden="true"></span>
        <div class="phone-display">
          <div class="phone-status" aria-hidden="true"><span>9:41</span><span class="phone-status-icons"><i></i><i></i><i class="wide"></i></span></div>
          <iframe #screen class="phone-screen" [src]="src" title="Vista previa de tu página" loading="eager"></iframe>
        </div>
      </div>
    </div>
    @if (sectionMissing()) {
      <p class="preview-note preview-note-static" data-preview-note>Esta sección aparece en tu página cuando añadas contenido.</p>
    }
  `,
})
export class SitePreview implements OnInit {
  private readonly store = inject(SiteSettingsStore);
  private readonly catalog = inject(CatalogApi);
  private readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private readonly screen = viewChild.required<ElementRef<HTMLIFrameElement>>('screen');
  private ready = false;

  readonly target = input<PreviewTarget>('top');

  protected readonly src = inject(DomSanitizer).bypassSecurityTrustResourceUrl(PREVIEW_PATH);
  protected readonly scale = signal(1);
  protected readonly wrapHeight = computed(() => Math.round(PHONE_HEIGHT * this.scale()));
  protected readonly sectionMissing = signal(false);
  protected readonly categories = signal<SiteCategory[]>([]);

  private readonly draft = toSignal(this.store.form.valueChanges.pipe(startWith(null)));
  protected readonly site = computed(() => {
    this.draft();
    const settings = this.store.settings();
    const images = this.store.imagesState();
    return settings && images ? buildPreviewSite(settings, this.store.form.getRawValue(), images, this.categories()) : null;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    const onMessage = (event: MessageEvent) => {
      const message: PreviewMessage | null = readPreviewMessage(event, this.screen().nativeElement.contentWindow);
      if (message?.type === 'terraza-preview-ready') {
        this.ready = true;
        this.post();
      } else if (message?.type === 'terraza-preview-section') {
        this.sectionMissing.set(message.missing);
      }
    };
    window.addEventListener('message', onMessage);
    const onResize = () => this.measure();
    window.addEventListener('resize', onResize);
    destroyRef.onDestroy(() => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
    });

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => this.measure());
      queueMicrotask(() => observer.observe(this.wrap().nativeElement));
      destroyRef.onDestroy(() => observer.disconnect());
    }
    effect(() => {
      this.site();
      this.target();
      this.post();
    });
  }

  ngOnInit(): void {
    void this.loadMenu();
  }

  private post(): void {
    const site = this.site();
    const target = this.screen().nativeElement.contentWindow;
    if (this.ready && site && target) {
      target.postMessage({ type: 'terraza-preview-data', site, target: this.target() } satisfies PreviewMessage, location.origin);
    }
  }

  private measure(): void {
    const width = this.wrap().nativeElement.clientWidth;
    if (width <= 0) {
      return;
    }
    const maxHeight = Math.max(360, (typeof innerHeight === 'number' ? innerHeight : 900) - 190);
    this.scale.set(Math.min(1, width / PHONE_WIDTH, maxHeight / PHONE_HEIGHT));
  }

  private async loadMenu(): Promise<void> {
    try {
      const categories = await firstValueFrom(this.catalog.categories());
      const result: SiteCategory[] = [];
      for (const category of categories.slice(0, MENU_CATEGORIES)) {
        const page = await firstValueFrom(this.catalog.items(category.id, true, 0, MENU_ITEMS));
        result.push({
          id: category.id,
          name: category.name,
          items: page.content.map(item => ({ id: item.id, name: item.name, description: item.description, price: item.price, tag: item.tag, imageUrl: item.imageUrl })),
        });
      }
      this.categories.set(result);
    } catch {
      this.categories.set([]);
    }
  }
}
