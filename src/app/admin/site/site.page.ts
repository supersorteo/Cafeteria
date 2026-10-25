import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { wideScreen } from '../../core/wide-screen';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Modal } from '../../shared/ui/modal';
import { SiteSettingsStore } from '../setup/site-settings.store';
import { PreviewPanel } from '../setup/preview-panel';
import { StepEditor } from '../setup/step-editor';
import { PreviewTarget, StepDef, StepId, requirementLabel, stepById } from '../setup/setup-steps';

@Component({
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialog, Modal, StepEditor, PreviewPanel],
  selector: 'app-site-page',
  providers: [SiteSettingsStore],
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black">Configuración</h1>

    @switch (store.state()) {
      @case ('ready') {
        @if (store.settings()) {
          @if (!store.isOwner()) {
            <p role="status" class="mt-4 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
              Solo el propietario puede cambiar la configuración del sitio. Tú puedes consultarla.
            </p>
          }
          @if (store.conflict() && !active()) {
            <div role="alert" class="mt-4 rounded-ui-md p-4 text-sm font-bold bg-warning/15 text-ink">
              La configuración cambió mientras la editabas, así que no se guardó para no pisar el otro cambio.
              <button type="button" data-reload (click)="store.reload()" class="underline ml-1">Recargar los datos actuales</button>
            </div>
          }

          <section class="mt-6 card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5" aria-label="Progreso de la configuración">
            <div class="flex items-center gap-5 flex-1 min-w-0">
              <div class="ring" [style.--p]="store.progress().percent" role="img" [attr.aria-label]="store.progress().percent + '% completado'">
                <span class="font-display font-black">{{ store.progress().done }}/{{ store.progress().total }}</span>
              </div>
              <div class="min-w-0">
                <h2 class="font-display text-xl md:text-2xl font-black">{{ store.progress().done }} de {{ store.progress().total }} pasos completos</h2>
                <p class="text-sm font-medium text-muted">Completa los pasos en orden: cada uno te dice para qué sirve y dónde se verá en tu página.</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              @if (store.nextStep(); as next) {
                <button type="button" data-next-step class="btn btn-secondary" (click)="open(next.id)">Continuar: {{ next.title }}</button>
              }
              <a routerLink="/admin/setup" [queryParams]="{ paso: store.nextStep()?.id }" data-open-wizard class="btn btn-primary">Abrir asistente</a>
            </div>
          </section>

          <ol class="mt-6 space-y-3" aria-label="Pasos de configuración">
            @for (step of store.steps(); track step.id; let i = $index) {
              <li class="step-row anim-fade-up" [class.done]="step.done" [style.--i]="i">
                <span class="step-num" [class.done]="step.done" aria-hidden="true">
                  @if (step.done) {
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  } @else {
                    {{ step.number }}
                  }
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <svg class="step-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="step.icon"/></svg>
                    <h3 class="font-display text-lg font-black">{{ step.title }}</h3>
                    <span class="badge" [class.badge-success]="step.done" [class.badge-warning]="!step.done && step.requirement === 'required'">{{ step.done ? 'Listo' : label(step.requirement) }}</span>
                  </div>
                  <p class="mt-1 text-sm font-medium" data-step-short>{{ step.short }}</p>
                  @if (step.example) {
                    <p class="mt-0.5 text-xs font-medium text-muted">Ejemplo: {{ step.example }}</p>
                  }
                  <p class="where-chip mt-2">Se ve en: {{ step.where }}</p>
                </div>
                @if (step.id === 'menu') {
                  <a [routerLink]="['/admin/menu']" [queryParams]="{ from: 'setup' }" data-open-menu class="btn btn-secondary btn-sm shrink-0">{{ step.done ? 'Editar carta' : 'Crear carta' }}</a>
                } @else {
                  <button type="button" class="btn btn-sm shrink-0" [class.btn-secondary]="step.done" [class.btn-primary]="!step.done" [attr.data-step]="step.id" (click)="open(step.id)">
                    {{ actionLabel(step) }}
                  </button>
                }
              </li>
            }
          </ol>

          @if (active(); as id) {
            <app-modal [heading]="title(id)" [size]="previewOpen() && wide() && id !== 'publish' ? 'full' : 'lg'" [dismissable]="!store.saving()" (closed)="tryClose()">
              @if (id !== 'publish') {
                <button modal-actions type="button" data-toggle-preview class="btn btn-secondary btn-sm" [attr.aria-pressed]="previewOpen()" (click)="previewOpen.set(!previewOpen())">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>
                  <span class="hidden sm:inline">Vista previa</span>
                </button>
              }
              <div class="step-split" [class.with-preview]="previewOpen() && wide() && id !== 'publish'">
                <div class="min-w-0">
                  <form id="step-form" [formGroup]="store.form" (ngSubmit)="save()" novalidate>
                    <app-step-editor [step]="id" (openStep)="open($event)" />
                  </form>
                </div>
                @if (id !== 'publish') {
                  <div class="step-preview">
                    <app-preview-panel [(open)]="previewOpen" [target]="target(id)" />
                  </div>
                }
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
              <div modal-footer class="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                <span class="sm:mr-auto text-xs font-bold text-warning">
                  @if (store.hasUnsavedChanges()) { Hay cambios sin guardar }
                </span>
                <button type="button" data-discard class="btn btn-secondary" [disabled]="store.saving()" (click)="tryClose()">
                  {{ id === 'publish' || !store.isOwner() ? 'Cerrar' : 'Cancelar' }}
                </button>
                @if (store.isOwner() && id !== 'publish') {
                  <button type="submit" form="step-form" data-save class="btn btn-primary" [disabled]="store.saving()" [class.btn-loading]="store.saving()">
                    {{ store.saving() ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                }
              </div>
            </app-modal>
          }

          @if (askDiscard()) {
            <app-confirm-dialog title="Descartar cambios" message="Tienes cambios sin guardar en este paso. Si cierras ahora, se perderán."
                                confirmLabel="Descartar" tone="danger" (confirmed)="discardAndClose()" (cancelled)="askDiscard.set(false)" />
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
        <div class="mt-8 space-y-3" role="status" aria-busy="true" aria-label="Cargando">
          <div class="skeleton h-24"></div>
          @for (n of [1, 2, 3, 4, 5]; track n) { <div class="skeleton h-20"></div> }
          <p class="sr-only">Cargando…</p>
        </div>
      }
    }
  `,
})
export class SitePage implements OnInit {
  protected readonly store = inject(SiteSettingsStore);

  protected readonly active = signal<StepId | null>(null);
  protected readonly askDiscard = signal(false);
  protected readonly wide = wideScreen();
  protected readonly previewOpen = signal(this.wide());
  protected readonly label = requirementLabel;
  protected readonly titles = computed(() => new Map(this.store.steps().map(step => [step.id, `${step.number}. ${step.title}`])));

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

  protected target(id: StepId): PreviewTarget {
    return stepById(id).target;
  }

  protected title(id: StepId): string {
    return this.titles().get(id) ?? stepById(id).title;
  }

  protected actionLabel(step: StepDef & { done: boolean }): string {
    if (step.id === 'publish') {
      return step.done ? 'Revisar' : 'Publicar';
    }
    if (!this.store.isOwner()) {
      return 'Ver';
    }
    return step.done ? 'Editar' : 'Completar';
  }

  protected open(id: StepId): void {
    if (this.active() && this.active() !== id && this.store.hasUnsavedChanges()) {
      this.store.discard();
    }
    this.store.serverError.set(null);
    this.active.set(id);
  }

  protected tryClose(): void {
    if (this.store.hasUnsavedChanges()) {
      this.askDiscard.set(true);
      return;
    }
    this.close();
  }

  protected discardAndClose(): void {
    this.askDiscard.set(false);
    this.close();
  }

  protected async save(): Promise<void> {
    if (await this.store.saveStep()) {
      this.active.set(null);
    }
  }

  protected async reload(): Promise<void> {
    this.active.set(null);
    await this.store.reload();
  }

  private close(): void {
    this.store.discard();
    this.active.set(null);
  }
}
