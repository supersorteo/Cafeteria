import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';
import { Tabs } from './tabs';

@Component({
  imports: [Modal],
  template: `
    <app-modal heading="Título de prueba" [dismissable]="dismissable()" (closed)="closes = closes + 1">
      <p>Contenido</p>
      <button modal-footer type="button" id="pie">Aceptar</button>
    </app-modal>
  `,
})
class ModalHost {
  readonly dismissable = signal(true);
  closes = 0;
}

@Component({
  imports: [Tabs],
  template: `<app-tabs [tabs]="tabs" [(selected)]="selected" />`,
})
class TabsHost {
  readonly tabs = [{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }, { id: 'c', label: 'Tres' }];
  readonly selected = signal('a');
}

describe('Modal', () => {
  it('should expose an accessible dialog labelled by its heading and project the footer', async () => {
    const fixture = TestBed.createComponent(ModalHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const dialog = root.querySelector('[role="dialog"]')!;
    const title = root.querySelector('h2')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent).toContain('Título de prueba');
    expect(root.querySelector('.modal-footer #pie')).not.toBeNull();
  });

  it('should emit closed from the close button and from Escape', async () => {
    const fixture = TestBed.createComponent(ModalHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-modal-close]')!.click();
    expect(fixture.componentInstance.closes).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closes).toBe(2);
  });

  it('should ignore dismissal and hide the close button when not dismissable', async () => {
    const fixture = TestBed.createComponent(ModalHost);
    fixture.componentInstance.dismissable.set(false);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-modal-close]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closes).toBe(0);
  });
});

describe('Tabs', () => {
  it('should select a tab on click and keep the roving tabindex', async () => {
    const fixture = TestBed.createComponent(TabsHost);
    await fixture.whenStable();
    const buttons = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    buttons()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('b');
    expect(buttons().map(button => button.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(buttons().map(button => button.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('should move with the arrow keys and wrap around', async () => {
    const fixture = TestBed.createComponent(TabsHost);
    await fixture.whenStable();
    const list = (fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')!;
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(fixture.componentInstance.selected()).toBe('c');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fixture.componentInstance.selected()).toBe('a');
  });
});
