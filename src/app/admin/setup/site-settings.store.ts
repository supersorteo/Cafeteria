import { Injectable, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApi, Dashboard } from '../../core/admin.api';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';
import { SiteAdminApi } from '../../core/site-admin.api';
import { SiteImages, SiteSettingsDetail } from '../../core/site-admin.models';
import { SiteForm, applySettings, createSiteForm, toPayload } from '../site/site-form';
import { SetupSnapshot, STEPS, StepDef, isStepDone, nextPendingStep, progressOf } from './setup-steps';

export interface ImagesHandle {
  hasUnsavedChanges(): boolean;
  save(): Promise<boolean>;
  discard(): void;
}

const MISSING_LABELS: Record<string, string> = { whatsappNumber: 'el número de WhatsApp' };

@Injectable()
export class SiteSettingsStore {
  private readonly api = inject(SiteAdminApi);
  private readonly admin = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly notices = inject(NoticeService);
  private readonly fb = inject(NonNullableFormBuilder);
  private images: ImagesHandle | null = null;
  private currencyAnswer: ((accepted: boolean) => void) | null = null;

  readonly isOwner = this.auth.isOwner;
  readonly form: SiteForm = createSiteForm(this.fb);

  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly settings = signal<SiteSettingsDetail | null>(null);
  readonly imagesState = signal<SiteImages | null>(null);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly conflict = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly missing = signal<string | null>(null);
  readonly askCurrency = signal(false);

  readonly snapshot = computed<SetupSnapshot | null>(() => {
    const settings = this.settings();
    if (!settings) {
      return null;
    }
    const images = this.imagesState();
    return {
      settings: images ? { ...settings, images } : settings,
      categories: this.dashboard()?.categories ?? 0,
      activeItems: this.dashboard()?.activeItems ?? 0,
    };
  });
  readonly steps = computed(() => {
    const snapshot = this.snapshot();
    return STEPS.map(step => ({ ...step, done: snapshot ? isStepDone(step.id, snapshot) : false }));
  });
  readonly progress = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? progressOf(snapshot) : { done: 0, total: STEPS.length, percent: 0 };
  });
  readonly nextStep = computed<StepDef | null>(() => {
    const snapshot = this.snapshot();
    return snapshot ? nextPendingStep(snapshot) : null;
  });

  registerImages(handle: ImagesHandle | null): void {
    this.images = handle;
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || this.imagesDirty();
  }

  imagesDirty(): boolean {
    return this.images?.hasUnsavedChanges() ?? false;
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      const settings = await firstValueFrom(this.api.get());
      this.apply(settings);
      this.imagesState.set(settings.images);
    } catch {
      this.state.set('error');
      return;
    }
    await this.refreshDashboard();
    this.state.set('ready');
  }

  async refreshDashboard(): Promise<void> {
    try {
      this.dashboard.set(await firstValueFrom(this.admin.dashboard()));
    } catch {
      this.dashboard.set(null);
    }
  }

  async reload(): Promise<void> {
    this.conflict.set(false);
    await this.load();
  }

  discard(): void {
    const settings = this.settings();
    if (settings) {
      this.apply(settings);
      this.serverError.set(null);
      this.conflict.set(false);
    }
    this.images?.discard();
  }

  async saveStep(): Promise<boolean> {
    if (this.saving() || !this.isOwner()) {
      return false;
    }
    this.serverError.set(null);
    if (this.images?.hasUnsavedChanges() && !(await this.images.save())) {
      return false;
    }
    if (!this.form.dirty) {
      return true;
    }
    return this.submit();
  }

  async submit(): Promise<boolean> {
    if (this.saving() || !this.isOwner()) {
      return false;
    }
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.serverError.set('Revisa los campos marcados antes de guardar.');
      return false;
    }
    if (this.form.controls.currency.value !== this.settings()?.currency) {
      this.askCurrency.set(true);
      const accepted = await new Promise<boolean>(resolve => (this.currencyAnswer = resolve));
      if (!accepted) {
        return false;
      }
    }
    return this.doSave();
  }

  answerCurrency(accepted: boolean): void {
    this.askCurrency.set(false);
    this.currencyAnswer?.(accepted);
    this.currencyAnswer = null;
  }

  async doSave(): Promise<boolean> {
    const current = this.settings();
    if (!current || this.saving()) {
      return false;
    }
    this.saving.set(true);
    this.conflict.set(false);
    try {
      const saved = await firstValueFrom(this.api.update(toPayload(this.form, current.version)));
      this.apply(saved);
      this.notices.show('info', 'Cambios guardados.');
      return true;
    } catch (error) {
      this.handleSaveFailure(toProblem(error));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  onImagesSaved(saved: SiteSettingsDetail): void {
    this.settings.update(current => (current ? { ...current, images: saved.images, version: saved.version } : saved));
    this.imagesState.set(saved.images);
    this.notices.show('info', 'Imágenes guardadas.');
  }

  async setPublished(published: boolean): Promise<boolean> {
    const current = this.settings();
    if (!current || this.publishing() || this.hasUnsavedChanges()) {
      return false;
    }
    this.publishing.set(true);
    this.missing.set(null);
    try {
      const updated = await firstValueFrom(this.api.setPublication(published, current.version));
      this.settings.update(value => (value ? { ...value, published: updated.published, version: updated.version } : updated));
      this.notices.show('info', published ? 'Tu sitio ya está publicado.' : 'Tu sitio quedó en borrador.');
      return true;
    } catch (error) {
      const problem = toProblem(error);
      if (problem.code === 'cannot_publish') {
        this.missing.set(problem.fieldErrors.map(f => MISSING_LABELS[f.field] ?? f.field).join(', '));
      } else if (problem.code === 'version_conflict') {
        this.conflict.set(true);
      } else if (isConnectionProblem(problem)) {
        this.notices.show('error', 'No pudimos cambiar la publicación por un problema de conexión.');
      }
      return false;
    } finally {
      this.publishing.set(false);
    }
  }

  private handleSaveFailure(problem: ReturnType<typeof toProblem>): void {
    if (problem.code === 'version_conflict') {
      this.conflict.set(true);
    } else if (problem.status === 400 && problem.fieldErrors.length > 0) {
      const unmatched: string[] = [];
      for (const { field, message } of problem.fieldErrors) {
        const control = (this.form.controls as Record<string, AbstractControl>)[field];
        if (control) {
          control.setErrors({ server: message });
          control.markAsTouched();
        } else {
          unmatched.push(message);
        }
      }
      this.serverError.set(unmatched.length > 0 ? `Revisa los datos: ${unmatched.join('; ')}` : 'Revisa los campos marcados.');
    } else if (isConnectionProblem(problem)) {
      this.serverError.set('No pudimos guardar por un problema de conexión. Tus cambios siguen aquí: inténtalo de nuevo.');
    } else if (problem.status !== 403) {
      this.serverError.set('No se pudo guardar la configuración.');
    }
  }

  private apply(settings: SiteSettingsDetail): void {
    this.settings.set(settings);
    applySettings(this.form, this.fb, settings, this.isOwner());
  }
}
