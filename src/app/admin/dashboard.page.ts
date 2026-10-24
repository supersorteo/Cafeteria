import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AdminApi, Dashboard } from '../core/admin.api';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: Dashboard };

@Component({
  imports: [RouterLink],
  selector: 'app-dashboard-page',
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black" style="color:var(--plum)">Resumen</h1>

    @switch (state().kind) {
      @case ('ready') {
        @if (data(); as d) {
          <section class="mt-8 bg-white rounded-3xl p-6 shadow-lg border-l-8"
                   [style.borderColor]="d.published ? 'var(--teal)' : 'var(--mango)'">
            <p class="text-xs font-bold uppercase tracking-widest text-teal">Tu sitio</p>
            <p class="mt-2 font-display text-2xl font-black" style="color:var(--plum)">{{ d.name }}</p>
            <p class="mt-2 font-medium" style="color:#5b4150">
              @if (d.published) {
                Está <strong>publicado</strong> y visible para cualquier persona en
                <a [href]="'/' + d.slug" target="_blank" rel="noopener" class="underline underline-offset-2 font-bold hover:text-coral">/{{ d.slug }}</a>.
              } @else {
                Está en <strong>borrador</strong>: todavía no es visible para el público.
                <a routerLink="/admin/site" class="underline underline-offset-2 font-bold hover:text-coral">Completa los datos y publícalo</a>.
              }
            </p>
          </section>

          <section class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Cifras">
            @for (card of cards(); track card.label) {
              <div class="bg-white rounded-3xl p-6 shadow-lg">
                <p class="font-display text-4xl font-black" [style.color]="card.color">{{ card.value }}</p>
                <p class="mt-1 text-xs font-bold uppercase tracking-widest" style="color:#5b4150">{{ card.label }}</p>
              </div>
            }
          </section>
        }
      }
      @case ('error') {
        <div class="mt-8 bg-white rounded-3xl p-6 shadow-lg" role="alert">
          <p class="font-bold" style="color:#E63946">No pudimos cargar el resumen.</p>
          <button type="button" (click)="reload()"
                  class="mt-4 bg-coral text-white font-bold px-6 py-2.5 rounded-full uppercase tracking-widest text-xs hover:brightness-110 transition-all">
            Reintentar
          </button>
        </div>
      }
      @default {
        <p class="mt-8 font-medium" style="color:#5b4150" role="status" aria-busy="true">Cargando…</p>
      }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  private readonly attempt = signal(0);

  protected readonly state = toSignal(
    toObservable(this.attempt).pipe(
      switchMap(() =>
        this.api.dashboard().pipe(
          map((data): State => ({ kind: 'ready', data })),
          catchError(() => of<State>({ kind: 'error' })),
          startWith<State>({ kind: 'loading' }),
        ),
      ),
    ),
    { initialValue: { kind: 'loading' } as State },
  );

  protected readonly data = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.data : null;
  });
  protected readonly cards = computed(() => {
    const d = this.data();
    return d
      ? [
          { label: 'Categorías', value: d.categories, color: 'var(--coral)' },
          { label: 'Productos activos', value: d.activeItems, color: 'var(--teal)' },
          { label: 'Productos inactivos', value: d.inactiveItems, color: 'var(--mango)' },
          { label: 'Imágenes', value: d.images, color: 'var(--plum)' },
        ]
      : [];
  });

  protected reload(): void {
    this.attempt.update(value => value + 1);
  }
}
