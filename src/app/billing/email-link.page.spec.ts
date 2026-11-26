import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { settle } from '../testing/http';
import { EMAIL_LINK_WAIT_MS, EmailLinkPage } from './email-link.page';
import { CHECKOUT_CHANNEL, CheckoutChannel, CheckoutMessage } from './sdk-loader';

@Component({ template: '' })
class Stub {}

describe('EmailLinkPage', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let checkoutTab: ((message: CheckoutMessage, reply: (answer: CheckoutMessage) => void) => void) | null;

  const root = () => harness.routeNativeElement as HTMLElement;
  const view = () => root().querySelector('[data-view]')?.getAttribute('data-view');
  const ui = async () => {
    await new Promise(resolve => setTimeout(resolve, 60));
    for (let i = 0; i < 3; i++) {
      await settle();
      harness.detectChanges();
    }
  };
  const channel = (): CheckoutChannel => {
    const fake: CheckoutChannel = {
      onmessage: null,
      postMessage: message => checkoutTab?.(message, answer => fake.onmessage?.({ data: answer } as MessageEvent<CheckoutMessage>)),
      close: () => undefined,
    };
    return fake;
  };

  beforeEach(async () => {
    checkoutTab = null;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'comprar/verificar', component: EmailLinkPage }, { path: 'comprar', component: Stub }, { path: 'precios', component: Stub }]),
        { provide: CHECKOUT_CHANNEL, useValue: channel },
        { provide: EMAIL_LINK_WAIT_MS, useValue: 20 },
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('should hand the code to the open purchase tab and say the email is verified', async () => {
    const received: CheckoutMessage[] = [];
    checkoutTab = (message, reply) => {
      received.push(message);
      reply({ type: 'email-ack', email: message.email });
    };
    await harness.navigateByUrl('/comprar/verificar?email=Ana%40Gmail.com&code=123456');
    await ui();

    expect(received).toEqual([{ type: 'email-code', email: 'ana@gmail.com', code: '123456' }]);
    expect(view()).toBe('handed');
    expect(localStorage.getItem('deliora.codigo')).toBeNull();
  });

  it('should resume the purchase in this tab when the original one is gone', async () => {
    localStorage.setItem('deliora.compra', JSON.stringify({
      plan: 'PROFESIONAL', region: 'AR', method: 'PAYPAL', businessName: 'Café Ana', slug: 'cafe-ana', email: 'ana@gmail.com', savedAt: Date.now(),
    }));
    await harness.navigateByUrl('/comprar/verificar?email=ana%40gmail.com&code=123456');
    await ui();

    expect(router.url).toBe('/comprar?continuar=1');
    expect(JSON.parse(localStorage.getItem('deliora.codigo') ?? '{}')).toMatchObject({ email: 'ana@gmail.com', code: '123456' });
  });

  it('should show the code to copy when there is no purchase to resume', async () => {
    await harness.navigateByUrl('/comprar/verificar?email=ana%40gmail.com&code=123456');
    await ui();

    expect(view()).toBe('code');
    expect(root().querySelector('[data-code]')?.textContent).toContain('123456');
  });

  it('should reject a broken link', async () => {
    await harness.navigateByUrl('/comprar/verificar?email=ana%40gmail.com&code=12');
    await ui();
    expect(view()).toBe('invalid');
  });
});
