import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutosizeDirective } from './autosize.directive';

@Component({
  imports: [AutosizeDirective, ReactiveFormsModule],
  template: `<textarea appAutosize [formControl]="control" rows="2"></textarea><textarea appAutosize rows="2" id="plain"></textarea>`,
})
class Host {
  readonly control = new FormControl('');
}

describe('AutosizeDirective', () => {
  function setup(scrollHeight: number) {
    const fixture = TestBed.createComponent(Host);
    const [bound, plain] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('textarea')) as HTMLTextAreaElement[];
    for (const area of [bound, plain]) {
      Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    }
    fixture.detectChanges();
    return { fixture, bound, plain };
  }

  it('should never keep its own vertical scroll so touch gestures reach the dialog', () => {
    const { bound } = setup(100);
    expect(bound.style.overflowY).toBe('hidden');
  });

  it('should grow to fit its content on init and when the user types', async () => {
    const { bound, plain } = setup(100);
    await Promise.resolve();
    expect(bound.style.height).toBe('102px');
    Object.defineProperty(plain, 'scrollHeight', { configurable: true, get: () => 180 });
    plain.dispatchEvent(new Event('input'));
    expect(plain.style.height).toBe('182px');
  });

  it('should follow programmatic value changes of the form control', async () => {
    const { fixture, bound } = setup(100);
    Object.defineProperty(bound, 'scrollHeight', { configurable: true, get: () => 240 });
    fixture.componentInstance.control.setValue('un texto mucho más largo\nen varias líneas');
    await Promise.resolve();
    await Promise.resolve();
    expect(bound.style.height).toBe('242px');
  });

  it('should leave the height alone when the browser reports no layout', async () => {
    const { bound } = setup(0);
    await Promise.resolve();
    expect(bound.style.height).toBe('auto');
  });
});
