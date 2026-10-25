import { Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NoticeService } from '../../core/notice.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { SiteSettingsStore } from './site-settings.store';
import { StepId, requirementLabel } from './setup-steps';

@Component({
  imports: [RouterLink, ConfirmDialog],
  selector: 'app-publish-panel',
  host: { class: 'block' },
  template: `
    @if (store.settings(); as site) {
      <section aria-labelledby="publication-title" class="card p-6 status-card" [class.live]="site.published">
        <div class="flex items-center gap-3">
          <h3 id="publication-title" class="text-xs font-bold uppercase tracking-wider text-muted">Publicación</h3>
          <span class="badge" [class.badge-success]="site.published" [class.badge-warning]="!site.published">
            <span class="pulse-dot" [class.live]="site.published"></span>{{ site.published ? 'Publicado' : 'Borrador' }}
          </span>
        </div>
        <p class="mt-2 font-medium text-muted">
          @if (site.published) {
            Tu sitio está <strong>publicado</strong>:
            <a [routerLink]="['/', site.slug]" [queryParams]="{ ref: 'panel' }" class="underline underline-offset-2 font-bold hover:text-primary break-all">{{ publicUrl() }}</a>
          } @else {
            Tu sitio está en <strong>borrador</strong>: solo tú lo ves desde el panel. Para publicarlo necesitas guardar tu número de WhatsApp.
          }
        </p>
        @if (store.missing(); as list) {
          <p role="alert" class="mt-3 text-sm font-bold text-danger">No se puede publicar todavía: falta {{ list }}.</p>
        }
        @if (store.isOwner() && store.hasUnsavedChanges()) {
          <p class="mt-3 text-xs font-bold text-warning">Guarda tus cambios antes de publicar o despublicar.</p>
        }
        @if (store.isOwner()) {
          <div class="mt-4 flex flex-wrap gap-2">
            @if (site.published) {
              <button type="button" data-copy (click)="copyLink()" class="btn btn-secondary">Copiar enlace</button>
              <button type="button" data-unpublish (click)="askUnpublish.set(true)" [disabled]="store.publishing() || store.hasUnsavedChanges()" class="btn btn-secondary !text-danger !border-danger/50">Despublicar</button>
            } @else {
              <button type="button" data-publish (click)="store.setPublished(true)" [disabled]="store.publishing() || store.hasUnsavedChanges()" class="btn btn-primary" [class.btn-loading]="store.publishing()">
                {{ store.publishing() ? 'Publicando…' : 'Publicar sitio' }}
              </button>
            }
          </div>
        }
      </section>

      <section class="mt-5" aria-label="Resumen de tu configuración">
        <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Resumen de tu configuración</h3>
        <ul class="mt-3 divide-y divide-line card">
          @for (step of reviewSteps(); track step.id) {
            <li class="flex items-center gap-3 px-4 py-3">
              <span class="check" [class.done]="step.done" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              </span>
              <span class="flex-1 min-w-0">
                <span class="block font-bold" [class.text-muted]="step.done">{{ step.number }}. {{ step.title }}</span>
                <span class="block text-xs font-medium text-muted">{{ step.done ? 'Listo' : label(step.requirement) }}</span>
              </span>
              @if (!step.done) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="openStep.emit(step.id)">Completar</button>
              }
            </li>
          }
        </ul>
      </section>

      @if (askUnpublish()) {
        <app-confirm-dialog title="Despublicar el sitio"
                            message="El sitio dejará de ser visible. Las imágenes que ya publicaste seguirán siendo accesibles para quien tenga su enlace."
                            confirmLabel="Despublicar" busyLabel="Despublicando…" [busy]="store.publishing()"
                            (confirmed)="unpublish()" (cancelled)="askUnpublish.set(false)" />
      }
    }
  `,
})
export class PublishPanel {
  protected readonly store = inject(SiteSettingsStore);
  private readonly notices = inject(NoticeService);

  readonly openStep = output<StepId>();
  protected readonly askUnpublish = signal(false);
  protected readonly label = requirementLabel;
  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;
  protected readonly publicUrl = computed(() => `${this.origin}/${this.store.settings()?.slug ?? ''}`);
  protected readonly reviewSteps = computed(() => this.store.steps().filter(step => step.id !== 'publish'));

  protected async unpublish(): Promise<void> {
    await this.store.setPublished(false);
    this.askUnpublish.set(false);
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl());
      this.notices.show('info', 'Enlace copiado.');
    } catch {
      this.notices.show('error', 'No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }
}
