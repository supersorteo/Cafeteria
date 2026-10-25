import { Component, HostListener, OnInit, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { wideScreen } from '../../core/wide-screen';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { SiteSettingsStore } from './site-settings.store';
import { PreviewPanel } from './preview-panel';
import { STEPS, StepId, isStepDone, requirementLabel, stepById } from './setup-steps';
import { StepEditor } from './step-editor';

@Component({
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialog, StepEditor, PreviewPanel],
  selector: 'app-setup-page',
  providers: [SiteSettingsStore],
  template: `
    @switch (store.state()) {
      @case ('ready') {
        @if (store.settings()) {
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="font-display text-3xl md:text-4xl font-black">Configura tu negocio</h1>
              <p class="mt-1 text-sm font-medium text-muted" data-progress-text>Paso {{ def().number }} de {{ total }} · {{ store.progress().done }} completos</p>
            </div>
            <div class="flex items-center gap-2">
              @if (def().id !== 'publish') {
                <button type="button" data-toggle-preview class="btn btn-secondary btn-sm" [attr.aria-pressed]="previewOpen()" (click)="previewOpen.set(!previewOpen())">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>
                  Vista previa
                </button>
              }
              <a routerLink="/admin/site" data-leave class="btn btn-ghost btn-sm">Salir y seguir luego</a>
            </div>
          </header>

          <div class="wizard-bar mt-4" role="progressbar" aria-label="Progreso de la configuración" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="store.progress().percent">
            <span [style.width.%]="store.progress().percent"></span>
          </div>

          <ol class="stepper mt-5" aria-label="Pasos de configuración">
            @for (step of store.steps(); track step.id) {
              <li>
                <button type="button" class="stepper-btn" [class.current]="step.id === current()" [class.done]="step.done" [attr.data-wizard-step]="step.id"
                        [attr.aria-current]="step.id === current() ? 'step' : null" [attr.title]="step.number + '. ' + step.title" (click)="go(step.id)">
                  @if (step.done && step.id !== current()) {
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  } @else {
                    {{ step.number }}
                  }
                  <span class="sr-only">{{ step.title }}</span>
                </button>
              </li>
            }
          </ol>

          <div class="mt-6 wizard-grid" [class.with-preview]="previewOpen() && wide() && def().id !== 'publish'">
            <section class="card p-5 md:p-7 anim-fade-in" [attr.aria-labelledby]="'wizard-title'">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 id="wizard-title" class="font-display text-2xl md:text-3xl font-black">{{ def().number }}. {{ def().title }}</h2>
                <span class="badge" [class.badge-success]="isDone()" [class.badge-warning]="!isDone() && def().requirement === 'required'">{{ isDone() ? 'Completo' : label(def().requirement) }}</span>
              </div>

              <div class="mt-4">
                <form id="wizard-form" [formGroup]="store.form" (ngSubmit)="next()" novalidate>
                  <app-step-editor [step]="current()" (openStep)="go($event)" />
                </form>
              </div>

              @if (store.conflict()) {
                <div role="alert" class="mt-5 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
                  La configuración cambió mientras la editabas, así que no se guardó para no pisar el otro cambio.
                  <button type="button" data-reload (click)="reload()" class="underline ml-1">Recargar los datos actuales</button>
                </div>
              }
              @if (store.serverError(); as message) {
                <p role="alert" class="mt-5 rounded-ui-md bg-danger/10 px-4 py-3 text-sm font-bold text-danger anim-fade-in">{{ message }}</p>
              }

              <div class="mt-7 pt-5 border-t border-line flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                <button type="button" data-prev class="btn btn-secondary" [disabled]="def().number === 1 || store.saving()" (click)="prev()">← Atrás</button>
                <span class="sm:mr-auto text-xs font-bold text-warning">
                  @if (store.hasUnsavedChanges()) { Hay cambios sin guardar }
                </span>
                @if (def().id !== 'publish') {
                  @if (def().requirement !== 'required') {
                    <button type="button" data-skip class="btn btn-ghost" [disabled]="store.saving()" (click)="skip()">Omitir</button>
                  }
                  <button type="submit" form="wizard-form" data-continue class="btn btn-primary" [disabled]="store.saving()" [class.btn-loading]="store.saving()">
                    {{ continueLabel() }}
                  </button>
                } @else {
                  <a routerLink="/admin" data-finish class="btn btn-primary">Ir al resumen</a>
                }
              </div>
            </section>

            @if (def().id !== 'publish') {
              <div class="min-w-0">
                <app-preview-panel [(open)]="previewOpen" [target]="def().target" />
              </div>
            }
          </div>

          @if (pending(); as action) {
            <app-confirm-dialog title="Descartar cambios" message="Tienes cambios sin guardar en este paso. Si continúas, se perderán."
                                confirmLabel="Descartar" tone="danger" (confirmed)="confirmDiscard(action)" (cancelled)="pending.set(null)" />
          }
          @if (store.askCurrency()) {
            <app-confirm-dialog title="Cambiar la moneda"
                                message="Cambiar la moneda no convierte los precios de tu carta: los importes actuales se conservarán tal cual y tendrás que actualizarlos a mano."
                                confirmLabel="Guardar de todos modos" busyLabel="Guardando…" tone="primary" [busy]="store.saving()"
                                (confirmed)="store.answerCurrency(true)" (cancelled)="store.answerCurrency(false)" />
          }
        }
      }
      @case ('error') {
        <div role="alert" class="mt-8 card p-6">
          <p class="font-bold text-danger">No pudimos cargar la configuración de tu sitio.</p>
          <button type="button" data-retry (click)="store.load()" class="btn btn-primary mt-4">Reintentar</button>
        </div>
      }
      @default {
        <div class="space-y-3" role="status" aria-busy="true" aria-label="Cargando">
          <div class="skeleton h-12 w-2/3"></div>
          <div class="skeleton h-10"></div>
          <div class="skeleton h-96"></div>
          <p class="sr-only">Cargando…</p>
        </div>
      }
    }
  `,
})
export class SetupPage implements OnInit {
  protected readonly store = inject(SiteSettingsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly total = STEPS.length;
  protected readonly current = signal<StepId>('basics');
  protected readonly pending = signal<(() => void) | null>(null);
  protected readonly wide = wideScreen();
  protected readonly previewOpen = signal(this.wide());
  protected readonly label = requirementLabel;
  private started = false;

  constructor() {
    effect(() => {
      if (this.store.state() === 'ready' && !this.started) {
        this.started = true;
        const requested = this.route.snapshot.queryParamMap.get('paso');
        const valid = STEPS.find(step => step.id === requested);
        this.current.set(valid?.id ?? this.store.nextStep()?.id ?? 'publish');
      }
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.store.hasUnsavedChanges();
  }

  protected def() {
    return stepById(this.current());
  }

  protected isDone(): boolean {
    const snapshot = this.store.snapshot();
    return !!snapshot && isStepDone(this.current(), snapshot);
  }

  protected continueLabel(): string {
    if (this.current() === 'menu') {
      return 'Continuar';
    }
    return this.store.isOwner() ? 'Guardar y continuar' : 'Continuar';
  }

  protected go(id: StepId): void {
    if (id === this.current()) {
      return;
    }
    this.guarded(() => this.show(id));
  }

  protected prev(): void {
    const target = STEPS[this.def().number - 2];
    if (target) {
      this.guarded(() => this.show(target.id));
    }
  }

  protected skip(): void {
    this.guarded(() => this.advance());
  }

  protected async next(): Promise<void> {
    if (this.def().id === 'publish') {
      return;
    }
    if (!this.store.isOwner() || (await this.store.saveStep())) {
      this.advance();
    }
  }

  protected confirmDiscard(action: () => void): void {
    this.pending.set(null);
    this.store.discard();
    action();
  }

  protected async reload(): Promise<void> {
    await this.store.reload();
  }

  private advance(): void {
    const target = STEPS[this.def().number];
    if (target) {
      this.show(target.id);
    }
  }

  private show(id: StepId): void {
    this.store.serverError.set(null);
    this.current.set(id);
    void this.router.navigate([], { queryParams: { paso: id }, queryParamsHandling: 'merge', replaceUrl: true });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private guarded(action: () => void): void {
    if (this.store.hasUnsavedChanges()) {
      this.pending.set(action);
      return;
    }
    action();
  }
}
