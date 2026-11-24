import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { NoticeService } from '../core/notice.service';
import {
  ActivationCode, CodeBatch, CodeFilters, CodePage, CodeStats, CodeStatusFilter, DURATIONS, DURATION_LABELS, GeneratedBatch, PLAN_OPTIONS, SuperAdminApi,
} from '../core/superadmin.api';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { EmptyState } from '../shared/ui/empty-state';
import { Modal } from '../shared/ui/modal';

type Action = { kind: 'disable' | 'enable' | 'delete'; code: ActivationCode };

export const POLL_MS = 5000;

const STATUS_LABELS: Record<string, string> = { AVAILABLE: 'Disponible', REDEEMED: 'Canjeado', DISABLED: 'Deshabilitado' };

@Component({
  imports: [DatePipe, NgTemplateOutlet, FormsModule, ConfirmDialog, EmptyState, Modal],
  selector: 'app-superadmin-codes',
  host: { class: 'block' },
  template: `
    <section aria-label="Resumen de códigos" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-code-stats>
      @for (item of statItems(); track item.label; let last = $last) {
        <div [class]="last ? 'card p-4 col-span-2 sm:col-span-1' : 'card p-4'">
          <p class="text-xs font-bold uppercase tracking-wider text-muted">{{ item.label }}</p>
          <p class="mt-1 font-display text-3xl font-black" [class.text-danger]="item.danger">{{ item.value }}</p>
        </div>
      }
    </section>

    @if (api.scope() === 'mine') {
    <section aria-label="Generar lote" class="card p-4 sm:p-5 mt-6" data-generate>
      <h2 class="font-display text-xl font-black">Generar un lote de códigos</h2>
      <p class="text-sm font-medium text-muted mt-1">Cada código sirve una sola vez. El plazo empieza cuando el cliente lo canjea.</p>
      <form class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end" (ngSubmit)="askGenerate()" #batchForm="ngForm">
        <div>
          <label for="gen-plan" class="text-xs font-bold uppercase tracking-wider text-muted">Plan</label>
          <select id="gen-plan" name="plan" class="input mt-2" data-gen-plan [ngModel]="genPlan()" (ngModelChange)="genPlan.set($event)">
            @for (p of plans; track p.code) { <option [value]="p.code">{{ p.label }}</option> }
          </select>
        </div>
        <div>
          <label for="gen-duration" class="text-xs font-bold uppercase tracking-wider text-muted">Duración</label>
          <select id="gen-duration" name="duration" class="input mt-2" [ngModel]="genDuration()" (ngModelChange)="genDuration.set(+$event)">
            @for (d of durations; track d.months) { <option [value]="d.months">{{ d.label }}</option> }
          </select>
        </div>
        <div>
          <label for="gen-quantity" class="text-xs font-bold uppercase tracking-wider text-muted">Cantidad (1 a 500)</label>
          <input id="gen-quantity" name="quantity" type="number" min="1" max="500" inputmode="numeric" class="input mt-2" [ngModel]="genQuantity()" (ngModelChange)="genQuantity.set(+$event)">
        </div>
        <div>
          <label for="gen-label" class="text-xs font-bold uppercase tracking-wider text-muted">Etiqueta (opcional)</label>
          <input id="gen-label" name="label" maxlength="80" class="input mt-2" placeholder="Ej. Promo noviembre" [ngModel]="genLabel()" (ngModelChange)="genLabel.set($event)">
        </div>
        <button type="submit" class="btn btn-primary" data-generate-submit [disabled]="generating() || !validQuantity()">{{ generating() ? 'Generando…' : 'Generar códigos' }}</button>
      </form>
      @if (generateError()) { <p role="alert" class="mt-3 text-sm font-bold text-danger">{{ generateError() }}</p> }

      @if (generated(); as batch) {
        <div class="mt-5 rounded-ui-lg border border-line p-4" data-generated>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="font-bold">Lote «{{ batch.label }}»: {{ batch.codes.length }} código{{ batch.codes.length === 1 ? '' : 's' }} {{ planLabel(batch.planCode) }} de {{ durationLabel(batch.durationMonths) }}</p>
            <div class="flex gap-2">
              <button type="button" class="btn btn-secondary btn-sm" data-copy-all (click)="copyAll(batch)">Copiar todos</button>
              <button type="button" class="btn btn-secondary btn-sm" data-download (click)="download(batch)">Descargar CSV</button>
            </div>
          </div>
          <pre class="mt-3 max-h-48 overflow-auto rounded-ui-md bg-surface-2 p-3 text-sm font-bold tracking-wider" data-generated-codes>{{ batch.codes.join('\\n') }}</pre>
        </div>
      }
    </section>
    }

    <section aria-label="Códigos" class="mt-6 space-y-4" data-code-list>
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <p class="text-xs font-medium text-muted" data-updated>@if (updatedAt(); as at) { Actualizado a las {{ at | date: 'HH:mm:ss' }} · se refresca solo cada 5 segundos } @else { Cargando… }</p>
        <button type="button" class="btn btn-secondary btn-sm" data-refresh [disabled]="loading()" (click)="refreshNow()">Actualizar ahora</button>
      </div>
      <div class="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <input type="search" class="input lg:max-w-sm" placeholder="Buscar por código, correo o negocio" aria-label="Buscar códigos" data-code-search
               [ngModel]="filters().query" (ngModelChange)="onSearch($event)">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          @for (option of statusOptions; track option.id) {
            <button type="button" class="btn btn-sm" [class.btn-primary]="filters().status === option.id" [class.btn-secondary]="filters().status !== option.id"
                    [attr.aria-pressed]="filters().status === option.id" [attr.data-code-status]="option.id" (click)="setStatus(option.id)">{{ option.label }}</button>
          }
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <select class="input" aria-label="Filtrar por duración" data-code-duration [ngModel]="filters().durationMonths ?? ''" (ngModelChange)="setDuration($event)">
          <option value="">Todas las duraciones</option>
          @for (d of durations; track d.months) { <option [value]="d.months">{{ d.label }}</option> }
        </select>
        <select class="input" aria-label="Filtrar por lote" data-code-batch [ngModel]="filters().batchId" (ngModelChange)="setBatch($event)">
          <option value="">Todos los lotes</option>
          @for (b of batches(); track b.id) { <option [value]="b.id">{{ b.label }} · {{ planLabel(b.planCode) }} · {{ durationLabel(b.durationMonths) }} · {{ b.available }}/{{ b.quantity }} libres</option> }
        </select>
      </div>

      @if (error()) {
        <div class="card p-5 text-center" role="alert">
          <p class="font-bold text-danger">{{ error() }}</p>
          <button type="button" class="btn btn-secondary btn-sm mt-3" data-codes-retry (click)="load()">Reintentar</button>
        </div>
      } @else if (loading() && !page()) {
        <div class="space-y-3" aria-hidden="true"><div class="skeleton h-14"></div><div class="skeleton h-14"></div></div>
      } @else if (page(); as data) {
        @if (data.content.length === 0) {
          <app-empty-state title="Sin códigos" text="Genera un lote arriba o cambia los filtros." />
        } @else {
          <ng-container *ngTemplateOutlet="pager; context: { $implicit: data, where: 'top' }" />

          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-code-cards [class.opacity-60]="loading()">
            @for (code of data.content; track code.id) {
              <li class="card p-4 flex flex-col min-w-0" data-code-row [attr.data-code]="code.code">
                <div class="flex items-start justify-between gap-3">
                  <p class="min-w-0 truncate font-bold tracking-wider" [title]="code.code">{{ code.code }}</p>
                  <ng-container *ngTemplateOutlet="badge; context: { $implicit: code }" />
                </div>
                <p class="mt-1 truncate text-xs text-muted" [title]="durationLabel(code.durationMonths) + ' · ' + code.batchLabel">{{ planLabel(code.planCode) }} · {{ durationLabel(code.durationMonths) }} · {{ code.batchLabel }}</p>
                <div class="mt-3 min-w-0 flex-1 space-y-0.5 text-sm" data-code-detail>
                  @if (code.tenantSlug) {
                    <div data-code-business>
                      <p class="truncate font-bold" [title]="code.tenantName">{{ code.tenantName }}</p>
                      <p class="truncate text-xs text-muted" [title]="'/' + code.tenantSlug">/{{ code.tenantSlug }}</p>
                    </div>
                    <p class="truncate" data-code-email [title]="code.redeemedByEmail ?? ''">{{ code.redeemedByEmail ?? '—' }}</p>
                    <p class="text-xs text-muted" data-code-registered>Registro {{ code.redeemedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
                    <p class="text-xs font-medium" data-code-expires [class.text-danger]="code.planStatus === 'EXPIRED'">{{ code.planExpiresAt ? (code.planStatus === 'EXPIRED' ? 'Venció el ' : 'Vence el ') + (code.planExpiresAt | date: 'dd/MM/yyyy') : 'Sin vencimiento' }}</p>
                  } @else {
                    <p class="text-xs text-muted">Sin usar</p>
                  }
                </div>
                <div class="mt-3 flex flex-wrap gap-2"><ng-container *ngTemplateOutlet="actions; context: { $implicit: code }" /></div>
              </li>
            }
          </ul>

          <ng-container *ngTemplateOutlet="pager; context: { $implicit: data, where: 'bottom' }" />
        }
      }
    </section>

    <ng-template #pager let-data let-where="where">
      <div class="flex flex-wrap items-center justify-between gap-3" [attr.data-code-pager]="where">
        <p class="text-sm font-medium text-muted">{{ data.totalElements }} código{{ data.totalElements === 1 ? '' : 's' }} · página {{ data.page + 1 }} de {{ data.totalPages || 1 }}</p>
        <nav class="flex flex-wrap items-center gap-1.5" aria-label="Páginas de códigos">
          <button type="button" class="btn btn-secondary btn-sm" data-code-prev [disabled]="data.page === 0 || loading()" (click)="load(data.page - 1)">Anterior</button>
          @for (item of pageItems(data.page, data.totalPages); track $index) {
            @if (item === null) {
              <span class="px-1 text-muted" aria-hidden="true">…</span>
            } @else {
              <button type="button" class="btn btn-sm min-w-9 px-2" [class.btn-primary]="item === data.page" [class.btn-secondary]="item !== data.page"
                      [attr.aria-current]="item === data.page ? 'page' : null" [attr.data-code-page]="item + 1" [disabled]="loading()" (click)="load(item)">{{ item + 1 }}</button>
            }
          }
          <button type="button" class="btn btn-secondary btn-sm" data-code-next [disabled]="data.page + 1 >= data.totalPages || loading()" (click)="load(data.page + 1)">Siguiente</button>
        </nav>
      </div>
    </ng-template>

    <ng-template #badge let-code>
      <span class="badge shrink-0" [class.badge-success]="code.status === 'AVAILABLE'" [class.badge-warning]="code.status === 'DISABLED'">{{ statusLabel(code.status) }}</span>
    </ng-template>

    <ng-template #actions let-code>
      <button type="button" class="btn btn-secondary btn-sm" data-copy (click)="copy(code.code)">Copiar</button>
      @if (code.status === 'AVAILABLE' || code.status === 'REDEEMED') {
        <button type="button" class="btn btn-secondary btn-sm" data-disable (click)="ask('disable', code)">Deshabilitar</button>
      }
      @if (code.status === 'DISABLED') {
        <button type="button" class="btn btn-secondary btn-sm" data-enable (click)="ask('enable', code)">Habilitar</button>
      }
      <button type="button" class="btn btn-danger btn-sm" data-delete-code (click)="ask('delete', code)">Eliminar</button>
    </ng-template>

    @if (confirmingGenerate()) {
      <app-confirm-dialog title="Generar códigos"
        [message]="'Se crearán ' + genQuantity() + ' código' + (genQuantity() === 1 ? '' : 's') + ' ' + planLabel(genPlan()) + ' de ' + durationLabel(genDuration()) + '. Cada uno da acceso a crear un negocio.'"
        confirmLabel="Generar" busyLabel="Generando…" tone="primary" [busy]="generating()" (confirmed)="generate()" (cancelled)="confirmingGenerate.set(false)" />
    }

    @if (action(); as current) {
      @if (current.kind === 'delete' && current.code.tenantSlug) {
        <app-modal heading="Eliminar código y negocio" size="sm" [dismissable]="!busy()" (closed)="cancel()">
          <p class="font-medium text-muted">
            El código <strong class="text-ink">{{ current.code.code }}</strong> pertenece a <strong class="text-ink">{{ current.code.tenantName }}</strong>.
            Eliminarlo borra el negocio, su carta, sus fotos y sus usuarios. <strong class="text-danger">No se puede deshacer.</strong>
          </p>
          <label for="code-confirm" class="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Escribe <span class="text-ink normal-case">{{ current.code.tenantSlug }}</span> para confirmar</label>
          <input id="code-confirm" class="input mt-2" autocomplete="off" autocapitalize="off" spellcheck="false" data-confirm-slug [ngModel]="typed()" (ngModelChange)="typed.set($event)">
          <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" class="btn btn-secondary" data-cancel [disabled]="busy()" (click)="cancel()">Cancelar</button>
            <button type="button" class="btn btn-danger" data-confirm [disabled]="busy() || typed().trim() !== current.code.tenantSlug" (click)="confirm()">{{ busy() ? 'Eliminando…' : 'Eliminar definitivamente' }}</button>
          </div>
        </app-modal>
      } @else {
        <app-confirm-dialog
          [title]="current.kind === 'delete' ? 'Eliminar código' : current.kind === 'disable' ? 'Deshabilitar código' : 'Habilitar código'"
          [message]="actionMessage(current)"
          [confirmLabel]="current.kind === 'delete' ? 'Eliminar' : current.kind === 'disable' ? 'Deshabilitar' : 'Habilitar'" busyLabel="Procesando…"
          [tone]="current.kind === 'enable' ? 'primary' : 'danger'" [busy]="busy()" (confirmed)="confirm()" (cancelled)="cancel()" />
      }
    }
  `,
})
export class SuperAdminCodes implements OnInit, OnDestroy {
  protected readonly api = inject(SuperAdminApi);
  private readonly notices = inject(NoticeService);
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly durations = DURATIONS;
  protected readonly plans = PLAN_OPTIONS;
  protected readonly statusOptions: { id: CodeStatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'AVAILABLE', label: 'Disponibles' },
    { id: 'REDEEMED', label: 'Canjeados' },
    { id: 'DISABLED', label: 'Deshabilitados' },
  ];

  protected readonly stats = signal<CodeStats | null>(null);
  protected readonly batches = signal<CodeBatch[]>([]);
  protected readonly page = signal<CodePage | null>(null);
  protected readonly loading = signal(false);
  protected readonly updatedAt = signal<Date | null>(null);
  protected readonly error = signal<string | null>(null);
  private poll?: ReturnType<typeof setInterval>;
  protected readonly filters = signal<CodeFilters>({ status: 'all', durationMonths: null, batchId: '', query: '' });

  protected readonly genDuration = signal(1);
  protected readonly genPlan = signal<string>('PROFESIONAL');
  protected readonly genQuantity = signal(1);
  protected readonly genLabel = signal('');
  protected readonly generating = signal(false);
  protected readonly generateError = signal<string | null>(null);
  protected readonly generated = signal<GeneratedBatch | null>(null);

  protected readonly action = signal<Action | null>(null);
  protected readonly busy = signal(false);
  protected readonly typed = signal('');
  protected readonly confirmingGenerate = signal(false);

  ngOnInit(): void {
    void this.load(0);
    void this.refreshSide();
    this.poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !this.action() && !this.confirmingGenerate() && !this.loading()) {
        void this.load(undefined, true);
        void this.refreshSide();
      }
    }, POLL_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearInterval(this.poll);
  }

  protected refreshNow(): void {
    void this.load(undefined, true);
    void this.refreshSide();
  }

  protected statItems(): { label: string; value: number | string; danger?: boolean }[] {
    const s = this.stats();
    return [
      { label: 'Disponibles', value: s?.available ?? '—' },
      { label: 'Canjeados', value: s?.redeemed ?? '—' },
      { label: 'Deshabilitados', value: s?.disabled ?? '—' },
      { label: 'Planes por vencer (7 días)', value: s?.plansExpiringSoon ?? '—' },
      { label: 'Planes vencidos', value: s?.plansExpired ?? '—', danger: !!s && s.plansExpired > 0 },
    ];
  }

  protected planLabel(code: string | null | undefined): string {
    return PLAN_OPTIONS.find(p => p.code === code)?.label ?? 'Profesional';
  }

  protected durationLabel(months: number): string {
    return DURATION_LABELS[months] ?? `${months} meses`;
  }

  protected pageItems(current: number, total: number): (number | null)[] {
    const wanted = new Set([0, total - 1, current - 1, current, current + 1].filter(n => n >= 0 && n < total));
    const sorted = [...wanted].sort((x, y) => x - y);
    const items: (number | null)[] = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) {
        items.push(null);
      }
      items.push(n);
    });
    return items;
  }

  protected statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected validQuantity(): boolean {
    const quantity = this.genQuantity();
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= 500;
  }

  protected onSearch(value: string): void {
    this.filters.update(f => ({ ...f, query: value }));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.load(0), 300);
  }

  protected setStatus(status: CodeStatusFilter): void {
    this.filters.update(f => ({ ...f, status }));
    void this.load(0);
  }

  protected setDuration(value: string | number): void {
    this.filters.update(f => ({ ...f, durationMonths: value === '' ? null : +value }));
    void this.load(0);
  }

  protected setBatch(batchId: string): void {
    this.filters.update(f => ({ ...f, batchId }));
    void this.load(0);
  }

  protected async load(index = this.page()?.page ?? 0, silent = false): Promise<void> {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    try {
      this.page.set(await firstValueFrom(this.api.codes(this.filters(), index)));
      this.updatedAt.set(new Date());
    } catch (error) {
      if (silent && this.page()) {
        return;
      }
      this.error.set(isConnectionProblem(toProblem(error)) ? 'Problema de conexión. Inténtalo de nuevo.' : 'No pudimos cargar los códigos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async generate(): Promise<void> {
    if (this.generating() || !this.validQuantity()) {
      return;
    }
    this.generating.set(true);
    this.generateError.set(null);
    try {
      this.confirmingGenerate.set(true);
      this.generated.set(
        await firstValueFrom(
          this.api.createBatch({ label: this.genLabel().trim(), durationMonths: this.genDuration(), quantity: this.genQuantity(), note: '', planCode: this.genPlan() }),
        ),
      );
      this.notices.show('info', 'Lote generado.');
      void this.load(0);
      void this.refreshSide();
    } catch (error) {
      const problem = toProblem(error);
      this.generateError.set(problem.status === 400 ? 'Revisa la duración y la cantidad (1 a 500).' : 'No se pudo generar el lote.');
    } finally {
      this.generating.set(false);
      this.confirmingGenerate.set(false);
    }
  }

  protected async copy(code: string): Promise<void> {
    await this.toClipboard(code, 'Código copiado.');
  }

  protected async copyAll(batch: GeneratedBatch): Promise<void> {
    await this.toClipboard(batch.codes.join('\n'), `${batch.codes.length} códigos copiados.`);
  }

  protected download(batch: GeneratedBatch): void {
    const csv = ['codigo,duracion,lote', ...batch.codes.map(code => `${code},${this.durationLabel(batch.durationMonths)},"${batch.label.replace(/"/g, '""')}"`)].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `codigos-${batch.durationMonths}m-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  protected ask(kind: Action['kind'], code: ActivationCode): void {
    this.typed.set('');
    this.action.set({ kind, code });
  }

  protected actionMessage({ kind, code }: Action): string {
    const business = code.tenantName ? `«${code.tenantName}»` : '';
    if (kind === 'disable') {
      return code.tenantSlug
        ? `${code.code} está en uso por ${business}. Al deshabilitarlo se suspende el negocio: nadie podrá iniciar sesión y su sitio público dejará de verse hasta que lo habilites.`
        : `${code.code} dejará de servir para registrarse hasta que lo habilites de nuevo.`;
    }
    if (kind === 'enable') {
      return code.tenantSlug
        ? `Se reactivará ${business}: sus usuarios podrán entrar y su sitio volverá a verse.`
        : `${code.code} volverá a estar disponible.`;
    }
    return `Se eliminará ${code.code} para siempre.`;
  }

  protected askGenerate(): void {
    if (!this.generating() && this.validQuantity()) {
      this.confirmingGenerate.set(true);
    }
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.action.set(null);
    }
  }

  protected async confirm(): Promise<void> {
    const current = this.action();
    if (!current || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const { kind, code } = current;
      if (kind === 'disable') {
        await firstValueFrom(this.api.disableCode(code.id));
      } else if (kind === 'enable') {
        await firstValueFrom(this.api.enableCode(code.id));
      } else {
        await firstValueFrom(this.api.deleteCode(code.id, code.tenantSlug ? this.typed().trim() : undefined));
      }
      this.notices.show('info', { disable: 'Código deshabilitado.', enable: 'Código habilitado.', delete: 'Código eliminado.' }[kind]);
      void this.load();
      void this.refreshSide();
    } catch (error) {
      this.notices.show('error', toProblem(error).status === 409 ? 'El código ya cambió de estado. Se actualizó la lista.' : 'No se pudo completar la acción.');
      void this.load();
    } finally {
      this.action.set(null);
      this.busy.set(false);
    }
  }

  private async refreshSide(): Promise<void> {
    try {
      const [stats, batches] = await Promise.all([firstValueFrom(this.api.codeStats()), firstValueFrom(this.api.codeBatches())]);
      this.stats.set(stats);
      this.batches.set(batches);
    } catch {
      this.stats.set(null);
    }
  }

  private async toClipboard(text: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notices.show('info', message);
    } catch {
      this.notices.show('error', 'No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  }
}
