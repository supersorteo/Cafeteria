import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { makeSite } from '../../testing/site.fixture';
import { PreviewFramePage } from './preview-frame.page';

describe('PreviewFramePage', () => {
  let parentWindow: Window;
  let postToParent: ReturnType<typeof vi.spyOn>;
  let original: PropertyDescriptor | undefined;
  let holder: HTMLIFrameElement;

  const message = (data: unknown, overrides: Partial<MessageEventInit> = {}) =>
    window.dispatchEvent(new MessageEvent('message', { data, origin: location.origin, source: parentWindow, ...overrides }));
  const frames = () => new Promise(resolve => setTimeout(resolve, 60));

  beforeEach(() => {
    holder = document.createElement('iframe');
    document.body.appendChild(holder);
    parentWindow = holder.contentWindow as Window;
    postToParent = vi.spyOn(parentWindow, 'postMessage');
    original = Object.getOwnPropertyDescriptor(window, 'parent');
    Object.defineProperty(window, 'parent', { value: parentWindow, configurable: true });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(window, 'parent', original);
    }
    holder.remove();
    document.documentElement.removeAttribute('data-surface');
    vi.restoreAllMocks();
  });

  function create() {
    const fixture = TestBed.createComponent(PreviewFramePage);
    fixture.detectChanges();
    return fixture;
  }

  it('should announce itself to the parent and render nothing until it receives data', () => {
    const fixture = create();
    expect(postToParent).toHaveBeenCalledWith({ type: 'terraza-preview-ready' }, location.origin);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-public-site')).toBeNull();
  });

  it('should render the received draft with the public look', async () => {
    const fixture = create();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'top' });
    fixture.detectChanges();
    await fixture.whenStable();
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-public-site') as HTMLElement;
    expect(host.classList.contains('is-preview')).toBe(true);
    expect(host.textContent).toContain('Donde la noche');
    expect(document.documentElement.getAttribute('data-surface')).toBe('public');
  });

  it('should highlight the target section and report that it exists', async () => {
    const fixture = create();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'nosotros' });
    fixture.detectChanges();
    await frames();
    expect((fixture.nativeElement as HTMLElement).querySelector('#nosotros.preview-highlight')).not.toBeNull();
    expect(postToParent).toHaveBeenCalledWith({ type: 'terraza-preview-section', missing: false }, location.origin);
  });

  it('should report a missing section and highlight nothing', async () => {
    const fixture = create();
    const site = makeSite();
    message({ type: 'terraza-preview-data', site: { ...site, about: { title: null, text: null, imageUrls: [] }, stats: [] }, target: 'nosotros' });
    fixture.detectChanges();
    await frames();
    expect((fixture.nativeElement as HTMLElement).querySelector('.preview-highlight')).toBeNull();
    expect(postToParent).toHaveBeenCalledWith({ type: 'terraza-preview-section', missing: true }, location.origin);
  });

  it('should move the highlight when the target changes', async () => {
    const fixture = create();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'nosotros' });
    fixture.detectChanges();
    await frames();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'galeria' });
    fixture.detectChanges();
    await frames();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#nosotros.preview-highlight')).toBeNull();
    expect(root.querySelector('#galeria.preview-highlight')).not.toBeNull();
  });

  it('should ignore messages from another origin, another window or with another type', async () => {
    const fixture = create();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'top' }, { origin: 'https://evil.test' });
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'top' }, { source: window });
    message({ type: 'otra-cosa', site: makeSite() });
    message('texto suelto');
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-public-site')).toBeNull();
  });

  it('should keep the page scrollable but block links, buttons and forms from doing anything', async () => {
    const fixture = create();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'top' });
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const link = root.querySelector('a[href="#menu"]') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const form = new Event('submit', { bubbles: true, cancelable: true });
    root.querySelector('p')?.dispatchEvent(form);
    expect(form.defaultPrevented).toBe(true);
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    root.querySelector('h1')?.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });

  it('should stop listening and restore the platform surface when destroyed', async () => {
    const fixture = create();
    fixture.destroy();
    message({ type: 'terraza-preview-data', site: makeSite(), target: 'top' });
    expect(document.documentElement.getAttribute('data-surface')).toBe('platform');
  });
});
