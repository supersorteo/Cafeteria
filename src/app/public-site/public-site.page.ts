import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { SiteApi } from '../core/site.api';
import { ThemeService } from '../core/theme.service';
import { SiteData } from '../core/site.models';
import { NotFound } from '../not-found/not-found';
import { StatusScreen } from '../shared/ui/status-screen';
import { PublicSite } from './public-site';

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; site: SiteData };

@Component({
  imports: [PublicSite, NotFound, StatusScreen],
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
        <app-status-screen kind="error" title="No pudimos cargar el sitio" message="Hubo un problema de conexión. Revisa tu internet e inténtalo de nuevo.">
          <button type="button" (click)="reload()" class="btn btn-primary btn-lg">Reintentar</button>
        </app-status-screen>
      }
      @default {
        <app-status-screen kind="loading" title="Cargando…" />
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
    const theme = inject(ThemeService);
    theme.setSurface('public');
    inject(DestroyRef).onDestroy(() => theme.setSurface('platform'));
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
