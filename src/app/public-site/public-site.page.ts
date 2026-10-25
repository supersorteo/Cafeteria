import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { SiteApi } from '../core/site.api';
import { ThemeService } from '../core/theme.service';
import { SiteData } from '../core/site.models';
import { NotFound } from '../not-found/not-found';
import { ReturnBar, ReturnMode } from '../shared/ui/return-bar';
import { StatusScreen } from '../shared/ui/status-screen';
import { PublicSite } from './public-site';

type State =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'ready'; site: SiteData };

@Component({
  imports: [PublicSite, NotFound, StatusScreen, ReturnBar, RouterLink],
  selector: 'app-public-site-page',
  template: `
    @switch (status()) {
      @case ('ready') {
        <app-public-site [site]="site()!" />
      }
      @case ('not-found') {
        @if (barMode() === 'panel') {
          <app-status-screen kind="notfound" eyebrow="Error 404" title="No encontramos " accent="este sitio"
                             message="Tu sitio está en borrador o no existe. Publícalo desde Configuración para verlo.">
            <a routerLink="/admin" class="btn btn-primary btn-lg">Volver al panel</a>
          </app-status-screen>
        } @else {
          <app-not-found />
        }
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
    @if (barMode(); as mode) {
      @if (status() === 'ready') {
        <div class="h-20" style="background:var(--plum)" aria-hidden="true"></div>
      }
      <app-return-bar [mode]="mode" />
    }
  `,
})
export class PublicSitePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SiteApi);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly auth = inject(AuthService);
  private readonly doc = inject(DOCUMENT);
  private readonly attempt = signal(0);
  private tenantIcon: HTMLLinkElement | null = null;
  private replacedIcons: Element[] = [];

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

  protected readonly ref = toSignal(
    this.route.queryParamMap.pipe(
      map((params): ReturnMode | null => {
        const value = params.get('ref');
        return value === 'plataforma' || value === 'panel' ? value : null;
      }),
    ),
    { initialValue: null },
  );
  protected readonly barMode = computed<ReturnMode | null>(() => {
    const ref = this.ref();
    if (ref === 'panel') {
      return this.auth.state().status === 'authenticated' ? 'panel' : null;
    }
    return ref;
  });
  protected readonly status = computed(() => this.state().kind);
  protected readonly site = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.site : null;
  });

  constructor() {
    const theme = inject(ThemeService);
    theme.setSurface('public');
    inject(DestroyRef).onDestroy(() => theme.setSurface('platform'));
    inject(DestroyRef).onDestroy(() => this.applyIcon(null));
    effect(() => {
      if (this.ref() === 'panel') {
        void this.auth.ensureInitialized();
      }
    });
    effect(() => {
      const state = this.state();
      this.applyIcon(state.kind === 'ready' ? state.site.logoUrl : null);
      if (state.kind === 'ready') {
        this.title.setTitle(`${state.site.name} — Reservas por WhatsApp`);
        this.meta.updateTag({ name: 'description', content: state.site.hero.description ?? state.site.name });
      } else if (state.kind === 'not-found') {
        this.title.setTitle('Sitio no encontrado');
      }
    });
  }

  private applyIcon(url: string | null): void {
    const head = this.doc.head;
    if (this.tenantIcon) {
      this.tenantIcon.remove();
      this.tenantIcon = null;
      this.replacedIcons.forEach(node => head.appendChild(node));
      this.replacedIcons = [];
    }
    if (!url) {
      return;
    }
    this.replacedIcons = Array.from(head.querySelectorAll('link[rel~="icon"]'));
    this.replacedIcons.forEach(node => node.remove());
    const link = this.doc.createElement('link');
    link.rel = 'icon';
    link.href = url;
    head.appendChild(link);
    this.tenantIcon = link;
  }

  protected reload(): void {
    this.attempt.update(value => value + 1);
  }
}
