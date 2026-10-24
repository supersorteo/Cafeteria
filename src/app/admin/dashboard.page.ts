import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AdminApi, Dashboard } from '../core/admin.api';
import { NoticeService } from '../core/notice.service';
import { TickDirective } from '../shared/ui/tick.directive';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: Dashboard };

interface Step {
  label: string;
  hint: string;
  done: boolean;
  link: string;
  cta: string;
}

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
                  <a [href]="'/' + d.slug" target="_blank" rel="noopener" class="underline underline-offset-2 font-bold hover:text-primary">/{{ d.slug }}</a>.
                } @else {
                  Está en <strong>borrador</strong>: todavía no es visible para el público.
                  <a routerLink="/admin/site" class="underline underline-offset-2 font-bold hover:text-primary">Completa los datos y publícalo</a>.
                }
              </p>
            </div>
            @if (d.published) {
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-secondary" (click)="copyLink(d.slug)">Copiar enlace</button>
                <a [href]="'/' + d.slug" target="_blank" rel="noopener" class="btn btn-primary">Ver sitio ↗</a>
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

          @if (!allDone()) {
            <section class="mt-6 card p-6 md:p-7" aria-labelledby="start-title">
              <div class="flex items-center gap-5">
                <div class="ring" [style.--p]="progress()" role="img" [attr.aria-label]="progress() + '% completado'">
                  <span class="font-display font-black">{{ doneCount() }}/{{ steps().length }}</span>
                </div>
                <div>
                  <h2 id="start-title" class="font-display text-xl md:text-2xl font-black">Pon tu negocio en marcha</h2>
                  <p class="text-sm font-medium text-muted">Completa estos pasos para publicar una página que enamore.</p>
                </div>
              </div>
              <ul class="mt-5 divide-y divide-line">
                @for (step of steps(); track step.label) {
                  <li class="flex items-center gap-3 py-3">
                    <span class="check" [class.done]="step.done" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="font-bold" [class.line-through]="step.done" [class.text-muted]="step.done">{{ step.label }}</p>
                      <p class="text-xs font-medium text-muted">{{ step.hint }}</p>
                    </div>
                    @if (!step.done) {
                      <a [routerLink]="step.link" class="btn btn-secondary btn-sm">{{ step.cta }}</a>
                    }
                  </li>
                }
              </ul>
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
  protected readonly steps = computed<Step[]>(() => {
    const d = this.data();
    return d
      ? [
          { label: 'Crea tu carta', hint: 'Al menos una categoría con un producto activo.', done: d.categories > 0 && d.activeItems > 0, link: '/admin/menu', cta: 'Ir a la carta' },
          { label: 'Añade imágenes', hint: 'Fotos de tus platos y de tu local.', done: d.images > 0, link: '/admin/site', cta: 'Subir imágenes' },
          { label: 'Publica tu sitio', hint: 'Hazlo visible para tus clientes.', done: d.published, link: '/admin/site', cta: 'Publicar' },
        ]
      : [];
  });
  protected readonly doneCount = computed(() => this.steps().filter(step => step.done).length);
  protected readonly progress = computed(() => Math.round((this.doneCount() / Math.max(1, this.steps().length)) * 100));
  protected readonly allDone = computed(() => this.steps().length > 0 && this.doneCount() === this.steps().length);

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
