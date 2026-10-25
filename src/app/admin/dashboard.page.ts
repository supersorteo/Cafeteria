import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AdminApi, Dashboard } from '../core/admin.api';
import { NoticeService } from '../core/notice.service';
import { SiteAdminApi } from '../core/site-admin.api';
import { SiteSettingsDetail } from '../core/site-admin.models';
import { TickDirective } from '../shared/ui/tick.directive';
import { nextPendingStep, progressOf } from './setup/setup-steps';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: Dashboard };

@Component({
  imports: [RouterLink, TickDirective],
  selector: 'app-dashboard-page',
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black">Resumen</h1>

    @switch (state().kind) {
      @case ('ready') {
        @if (data(); as d) {
          <section class="mt-8 card p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5 status-card" [class.live]="d.published">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <p class="text-xs font-bold uppercase tracking-wider text-muted">Tu sitio</p>
                <span class="badge" [class.badge-success]="d.published" [class.badge-warning]="!d.published">
                  <span class="pulse-dot" [class.live]="d.published"></span>{{ d.published ? 'Publicado' : 'Borrador' }}
                </span>
              </div>
              <p class="mt-2 font-display text-2xl md:text-3xl font-black break-words">{{ d.name }}</p>
              <p class="mt-2 font-medium text-muted">
                @if (d.published) {
                  Está <strong>publicado</strong> y visible para cualquier persona en
                  <a [routerLink]="['/', d.slug]" [queryParams]="{ ref: 'panel' }" class="underline underline-offset-2 font-bold hover:text-primary">/{{ d.slug }}</a>.
                } @else {
                  Está en <strong>borrador</strong>: todavía no es visible para el público.
                  <a routerLink="/admin/setup" class="underline underline-offset-2 font-bold hover:text-primary">Completa la configuración y publícalo</a>.
                }
              </p>
            </div>
            @if (d.published) {
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-secondary" (click)="copyLink(d.slug)">Copiar enlace</button>
                <a [routerLink]="['/', d.slug]" [queryParams]="{ ref: 'panel' }" class="btn btn-primary">Ver sitio</a>
              </div>
            }
          </section>

          <section class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Cifras">
            @for (card of cards(); track card.label; let i = $index) {
              <div class="card card-hover p-5 md:p-6 anim-fade-up" [style.--i]="i">
                <p class="font-display text-4xl font-black" [class]="card.tone" [appTick]="card.value"></p>
                <p class="mt-1 text-xs font-bold uppercase tracking-wider text-muted">{{ card.label }}</p>
              </div>
            }
          </section>

          @if (setup(); as s) {
            <section class="mt-6 card p-6 md:p-7" aria-labelledby="setup-title" data-setup-card>
              <div class="flex flex-col md:flex-row md:items-center gap-5">
                <div class="flex items-center gap-5 flex-1 min-w-0">
                  <div class="ring" [style.--p]="s.percent" role="img" [attr.aria-label]="s.percent + '% completado'">
                    <span class="font-display font-black">{{ s.done }}/{{ s.total }}</span>
                  </div>
                  <div class="min-w-0">
                    <h2 id="setup-title" class="font-display text-xl md:text-2xl font-black">
                      {{ s.next ? 'Configura tu negocio' : 'Tu configuración está completa' }}
                    </h2>
                    <p class="text-sm font-medium text-muted">
                      @if (s.next) {
                        {{ s.done }} de {{ s.total }} pasos completos. Siguiente: <strong class="text-ink">{{ s.next.title }}</strong>.
                      } @else {
                        Todos los pasos están listos. Puedes editar cualquiera cuando quieras.
                      }
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  @if (s.next) {
                    <a routerLink="/admin/setup" [queryParams]="{ paso: s.next.id }" data-open-wizard class="btn btn-primary">Continuar con el asistente</a>
                  }
                  <a routerLink="/admin/site" data-open-list class="btn btn-secondary">Ver todos los pasos</a>
                </div>
              </div>
            </section>
          }
        }
      }
      @case ('error') {
        <div class="mt-8 card p-6" role="alert">
          <p class="font-bold text-danger">No pudimos cargar el resumen.</p>
          <button type="button" (click)="reload()" class="btn btn-primary mt-4">Reintentar</button>
        </div>
      }
      @default {
        <div class="mt-8 space-y-4" role="status" aria-busy="true" aria-label="Cargando">
          <div class="skeleton h-28"></div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4"><div class="skeleton h-24"></div><div class="skeleton h-24"></div><div class="skeleton h-24"></div><div class="skeleton h-24"></div></div>
          <p class="sr-only">Cargando…</p>
        </div>
      }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  private readonly siteApi = inject(SiteAdminApi);
  private readonly notices = inject(NoticeService);
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

  private readonly settings = toSignal(
    toObservable(this.attempt).pipe(
      switchMap(() => this.siteApi.get().pipe(catchError(() => of<SiteSettingsDetail | null>(null)))),
    ),
    { initialValue: null as SiteSettingsDetail | null },
  );

  protected readonly data = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.data : null;
  });
  protected readonly cards = computed(() => {
    const d = this.data();
    return d
      ? [
          { label: 'Categorías', value: d.categories, tone: 'text-primary' },
          { label: 'Productos activos', value: d.activeItems, tone: 'text-brand' },
          { label: 'Productos inactivos', value: d.inactiveItems, tone: 'text-gold' },
          { label: 'Imágenes', value: d.images, tone: 'text-ink' },
        ]
      : [];
  });
  protected readonly setup = computed(() => {
    const d = this.data();
    const settings = this.settings();
    if (!d || !settings) {
      return null;
    }
    const snapshot = { settings, categories: d.categories, activeItems: d.activeItems };
    return { ...progressOf(snapshot), next: nextPendingStep(snapshot) };
  });

  protected reload(): void {
    this.attempt.update(value => value + 1);
  }

  protected async copyLink(slug: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${location.origin}/${slug}`);
      this.notices.show('info', 'Enlace copiado al portapapeles.', 3000);
    } catch {
      this.notices.show('error', 'No pudimos copiar el enlace. Cópialo desde la barra del navegador.');
    }
  }
}
