import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { SiteApi } from '../core/site.api';
import { SiteData } from '../core/site.models';
import { NotFound } from '../not-found/not-found';
import { PublicSite } from './public-site';

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; site: SiteData };

@Component({
  imports: [PublicSite, NotFound],
  selector: 'app-public-site-page',
  template: `
    @switch (status()) {
      @case ('ready') {
        <app-public-site [site]="site()!" />
      }
      @case ('not-found') {
        <app-not-found />
      }
      @case ('error') {
        <main class="min-h-screen flex items-center justify-center px-5 text-center">
          <div class="max-w-md">
            <h1 class="font-display text-3xl font-black" style="color:var(--plum)">No pudimos cargar el sitio</h1>
            <p class="mt-4 font-medium" style="color:#5b4150">
              Hubo un problema de conexión. Revisa tu internet e inténtalo de nuevo.
            </p>
            <button type="button" (click)="reload()"
                    class="mt-8 bg-coral text-white font-bold px-8 py-3.5 rounded-full uppercase tracking-widest text-sm hover:brightness-110 transition-all">
              Reintentar
            </button>
          </div>
        </main>
      }
      @default {
        <main class="min-h-screen flex items-center justify-center px-5 text-center" aria-busy="true" role="status">
          <p class="font-display text-2xl font-black text-coral">Cargando…</p>
        </main>
      }
    }
  `,
})
export class PublicSitePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SiteApi);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly attempt = signal(0);

  private readonly state = toSignal(
    combineLatest([
      this.route.paramMap.pipe(map(params => params.get('slug') ?? '')),
      toObservable(this.attempt),
    ]).pipe(
      switchMap(([slug]) =>
        this.api.get(slug).pipe(
          map((site): State => ({ kind: 'ready', site })),
          catchError((error: HttpErrorResponse) =>
            of<State>(error.status === 404 ? { kind: 'not-found' } : { kind: 'error' })),
          startWith<State>({ kind: 'loading' }),
        ),
      ),
    ),
    { initialValue: { kind: 'loading' } as State },
  );

  protected readonly status = computed(() => this.state().kind);
  protected readonly site = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.site : null;
  });

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.kind === 'ready') {
        this.title.setTitle(`${state.site.name} — Reservas por WhatsApp`);
        this.meta.updateTag({ name: 'description', content: state.site.hero.description ?? state.site.name });
      } else if (state.kind === 'not-found') {
        this.title.setTitle('Sitio no encontrado');
      }
    });
  }

  protected reload(): void {
    this.attempt.update(value => value + 1);
  }
}
