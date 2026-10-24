import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SiteData } from '../core/site.models';
import { emptySite, makeSite } from '../testing/site.fixture';
import { PublicSite } from './public-site';

async function render(site: SiteData): Promise<ComponentFixture<PublicSite>> {
  const fixture = TestBed.createComponent(PublicSite);
  fixture.componentRef.setInput('site', site);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<PublicSite>) => fixture.nativeElement as HTMLElement;
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/ /g, ' ');

describe('PublicSite', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PublicSite] }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should render the tenant name, descriptor and hero with an emphasized second line', async () => {
    const root = html(await render(makeSite()));
    expect(text(root.querySelector('nav a')).replace(/\s+/g, ' ').trim()).toBe('Café Demo Bar & Cocina');
    const h1 = root.querySelector('h1')!;
    expect(text(h1)).toContain('Donde la noche');
    expect(h1.querySelector('br')).not.toBeNull();
    expect(text(h1.querySelector('span.italic'))).toBe('sabe mejor');
    expect(text(root.querySelector('header p'))).toContain('Desde 2012');
  });

  it('should apply the tenant theme colors as CSS variables', async () => {
    const fixture = await render(makeSite());
    const host = html(fixture);
    expect(host.style.getPropertyValue('--coral')).toBe('#112233');
    expect(host.style.getPropertyValue('--teal')).toBe('#445566');
  });

  it('should list only categories that have items and switch between them', async () => {
    const fixture = await render(makeSite());
    const root = html(fixture);
    const tabs = Array.from(root.querySelectorAll('button.tab-btn'));
    expect(tabs.map(tab => text(tab))).toEqual(['Cocteles', 'Postres']);
    expect(text(root.querySelector('.menu-card h3'))).toBe('Negroni');

    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(root.querySelector('.menu-card h3'))).toBe('Flan');
    expect(tabs[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('should render items without a photo and without description gracefully', async () => {
    const fixture = await render(makeSite());
    const root = html(fixture);
    const cards = root.querySelectorAll('.menu-card');
    expect(cards[1].querySelector('p.text-sm')).toBeNull();

    (root.querySelectorAll('button.tab-btn')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const flan = root.querySelector('.menu-card')!;
    expect(flan.querySelector('img')).toBeNull();
    expect(text(flan.querySelector('.menu-tag-inline'))).toBe('Dulce');
  });

  it('should format prices with the tenant currency and locale', async () => {
    const root = html(await render(makeSite()));
    const prices = Array.from(root.querySelectorAll('.menu-card .text-coral')).map(el => text(el));
    expect(prices[0]).toMatch(/^\$\s?180$/);
    expect(prices[1]).toMatch(/150[,.]5/);
  });

  it('should show every optional section when the tenant has content', async () => {
    const root = html(await render(makeSite()));
    expect(root.querySelector('#nosotros')).not.toBeNull();
    expect(root.querySelector('#galeria')).not.toBeNull();
    expect(root.querySelector('.marquee-track')).not.toBeNull();
    expect(text(root.querySelector('.marquee-track'))).toContain('Música en vivo · Happy hour');
    expect(root.querySelectorAll('.story-gallery img').length).toBe(3);
    expect(root.querySelectorAll('.atmosphere-image').length).toBe(2);
    expect(root.querySelector('.hero-visual')).not.toBeNull();
    expect(text(root.querySelector('.hero-image-caption'))).toContain('Una noche para disfrutar');
    expect(text(root.querySelector('footer'))).toContain('Lun a Vie · 18 a 02');
  });

  it('should count up the stats', async () => {
    const root = html(await render(makeSite()));
    const values = Array.from(root.querySelectorAll('#nosotros .font-display.text-3xl')).map(el => text(el));
    expect(values).toEqual(['14+', '120+']);
  });

  it('should hide every optional section for a brand-new tenant and never invent content', async () => {
    const fixture = await render(emptySite());
    const root = html(fixture);
    expect(root.querySelector('#nosotros')).toBeNull();
    expect(root.querySelector('#galeria')).toBeNull();
    expect(root.querySelector('.marquee-track')).toBeNull();
    expect(root.querySelector('.hero-visual')).toBeNull();
    expect(root.querySelector('a[href="#nosotros"]')).toBeNull();
    expect(root.querySelector('a[href="#galeria"]')).toBeNull();
    expect(text(root.querySelector('h1'))).toContain('Café Demo');
    expect(text(root.querySelector('#menu'))).toContain('La carta se está preparando');
    expect(root.querySelector('button.tab-btn')).toBeNull();
    expect(root.querySelector('#f-zona')).toBeNull();
    expect(Array.from(root.querySelectorAll('#f-personas option')).map(o => text(o))).toContain('+10 (evento)');
    expect(root.innerHTML).not.toContain('mailto:');
    expect(root.innerHTML).not.toContain('Horarios');
  });

  it('should pick up to three hero cards spread across categories', async () => {
    const category = (id: string, image: string) => ({
      id, name: id, items: [{ id: `${id}-1`, name: id, description: null, price: 1, tag: null, imageUrl: image }],
    });
    const site = makeSite({
      categories: [category('a', '/m/a'), category('b', '/m/b'), category('c', '/m/c'), category('d', '/m/d'), category('e', '/m/e')],
    });
    const cards = Array.from(html(await render(site)).querySelectorAll('.hero-photo-card img')).map(i => i.getAttribute('src'));
    expect(cards).toEqual(['/m/a', '/m/c', '/m/e']);
  });

  it('should associate every form label with its field', async () => {
    const root = html(await render(makeSite()));
    const labels = Array.from(root.querySelectorAll('#reservaForm label')) as HTMLLabelElement[];
    expect(labels.length).toBe(8);
    for (const label of labels) {
      expect(label.htmlFor, text(label)).not.toBe('');
      expect(root.querySelector(`#${label.htmlFor}`), label.htmlFor).not.toBeNull();
    }
  });

  it('should render a mailto link and avoid Cloudflare email protection', async () => {
    const root = html(await render(makeSite()));
    expect(root.querySelector('a[href="mailto:hola@cafedemo.test"]')).not.toBeNull();
    expect(root.innerHTML).not.toContain('cdn-cgi');
  });

  describe('reservation form', () => {
    async function fill(fixture: ComponentFixture<PublicSite>, values: Record<string, string>): Promise<HTMLFormElement> {
      const root = html(fixture);
      for (const [id, value] of Object.entries(values)) {
        const field = root.querySelector(`#${id}`) as HTMLInputElement;
        field.value = value;
        field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
      }
      fixture.detectChanges();
      await fixture.whenStable();
      return root.querySelector('#reservaForm') as HTMLFormElement;
    }

    it('should block a blank name and show an error without opening WhatsApp', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const fixture = await render(makeSite());
      const form = await fill(fixture, { 'f-nombre': '   ', 'f-fecha': '2999-01-01' });
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(open).not.toHaveBeenCalled();
      expect(text(html(fixture).querySelector('[role="alert"]'))).toContain('Escribe tu nombre');
    });

    it('should block dates in the past according to the tenant time zone', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const fixture = await render(makeSite());
      const form = await fill(fixture, { 'f-nombre': 'Ana', 'f-fecha': '2000-01-01' });
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(open).not.toHaveBeenCalled();
      expect(text(html(fixture).querySelector('[role="alert"]'))).toContain('fecha');
    });

    it('should open WhatsApp with a pending request, never a confirmed reservation', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const fixture = await render(makeSite());
      const form = await fill(fixture, { 'f-nombre': '  Ana  ', 'f-fecha': '2999-03-05', 'f-personas': '4', 'f-zona': 'Barra' });
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(open).toHaveBeenCalledTimes(1);
      const [url, target] = open.mock.calls[0] as [string, string];
      expect(target).toBe('_blank');
      expect(url.startsWith('https://wa.me/59899111222?text=')).toBe(true);
      const message = decodeURIComponent(url.split('text=')[1]);
      expect(message).toContain('reserva en Café Demo Bar & Cocina');
      expect(message).toContain('Nombre: Ana');
      expect(message).toContain('Personas: 4');
      expect(message).toContain('Zona: Barra');
      expect(message).toContain('marzo');
      expect(message).toContain('Quedo pendiente de su confirmación');
      expect(message.toLowerCase()).not.toContain('confirmada');
    });

    it('should omit the zone line when the tenant defines no zones', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const fixture = await render(makeSite({ reservation: { areas: [], partySizes: [] } }));
      const form = await fill(fixture, { 'f-nombre': 'Ana', 'f-fecha': '2999-03-05' });
      form.dispatchEvent(new Event('submit'));
      const message = decodeURIComponent((open.mock.calls[0] as [string])[0].split('text=')[1]);
      expect(message).not.toContain('Zona:');
      expect(message).toContain('Personas: 2');
    });
  });
});
