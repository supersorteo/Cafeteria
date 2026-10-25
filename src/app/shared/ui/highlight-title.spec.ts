import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { HighlightTitle, toggleHighlight } from './highlight-title';

@Component({
  imports: [HighlightTitle],
  template: `<app-highlight-title [control]="control" inputId="t" [maxLength]="max()" />`,
})
class Host {
  control = new FormControl('Donde la noche sabe mejor', { nonNullable: true });
  max = signal(160);
}

describe('toggleHighlight', () => {
  it('should wrap the selection in asterisks', () => {
    expect(toggleHighlight('Donde la noche sabe mejor', 15, 25)).toEqual({ value: 'Donde la noche *sabe mejor*', start: 15, end: 27 });
  });

  it('should remove the asterisks when the selection is already highlighted', () => {
    expect(toggleHighlight('Donde la noche *sabe mejor*', 16, 26)).toEqual({ value: 'Donde la noche sabe mejor', start: 15, end: 25 });
  });

  it('should highlight each line of a multi-line selection and keep blank lines', () => {
    expect(toggleHighlight('uno\ndos', 0, 7)?.value).toBe('*uno*\n*dos*');
  });

  it('should clean stray asterisks inside the selection and ignore an empty selection', () => {
    expect(toggleHighlight('a *b* c', 0, 7)?.value).toBe('a b c');
    expect(toggleHighlight('abc', 1, 1)).toBeNull();
    expect(toggleHighlight('a  b', 1, 3)).toBeNull();
  });
});

describe('HighlightTitle', () => {
  async function render(): Promise<{ host: Host; el: HTMLElement; box: HTMLTextAreaElement; fixture: ReturnType<typeof TestBed.createComponent<Host>> }> {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { host: fixture.componentInstance, el, box: el.querySelector('textarea') as HTMLTextAreaElement, fixture };
  }

  it('should highlight the selected word with the button and show the colored preview', async () => {
    const { host, el, box, fixture } = await render();
    box.setSelectionRange(15, 25);
    (el.querySelector('[data-highlight]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.control.value).toBe('Donde la noche *sabe mejor*');
    expect(host.control.dirty).toBe(true);
    expect(el.querySelector('[data-title-preview] span.italic')?.textContent).toBe('sabe mejor');
  });

  it('should not exceed the max length and should hide the button when disabled', async () => {
    const { host, el, box, fixture } = await render();
    host.max.set(25);
    fixture.detectChanges();
    box.setSelectionRange(15, 25);
    (el.querySelector('[data-highlight]') as HTMLButtonElement).click();
    expect(host.control.value).toBe('Donde la noche sabe mejor');

    host.control.disable();
    fixture.detectChanges();
    expect(el.querySelector('[data-highlight]')).toBeNull();
  });
});
