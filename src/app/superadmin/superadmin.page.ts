import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { NoticeService } from '../core/notice.service';
import { SuperAdminAudit, SuperAdminApi, SuperAdminTenantPage, SuperAdminStats, SuperAdminTenant, TenantStatusFilter } from '../core/superadmin.api';
import { SuperAdminAuth } from '../core/superadmin-auth.service';
import { ConfirmDialog } from '../shared/confirm-dialog';
import { EmptyState } from '../shared/ui/empty-state';
import { Modal } from '../shared/ui/modal';
import { Tabs } from '../shared/ui/tabs';
import { POLL_MS, SuperAdminCodes } from './superadmin-codes';
import { ThemeToggle } from '../shared/ui/theme-toggle';

type Action = { kind: 'suspend' | 'activate' | 'delete'; tenant: SuperAdminTenant };

const ACTION_LABELS: Record<string, string> = {
  TENANT_SUSPENDED: 'Suspendido',
  TENANT_ACTIVATED: 'Reactivado',
  TENANT_DELETED: 'Eliminado',
  SUPERADMIN_ACCOUNT_CREATED: 'Cuenta creada',
  SUPERADMIN_PASSWORD_CHANGED: 'Contraseña cambiada',
};

@Component({
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, SuperAdminCodes, Tabs, ThemeToggle, ConfirmDialog, Modal, EmptyState],
  selector: 'app-superadmin-page',
  template: `
    <div class="min-h-screen bg-app">
      <header class="glass sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-8 py-2.5 !border-x-0 !border-t-0">
        <div class="min-w-0">
          <p class="font-display text-lg font-black leading-tight">Superadmin <span class="badge ml-1 align-middle" data-role>{{ auth.isAdmin() ? 'Administrador' : 'Operador' }}</span></p>
          <p class="text-xs font-medium text-muted truncate">{{ auth.email() }}</p>
        </div>
        <div class="flex items-center gap-1">
          <app-theme-toggle />
          @if (auth.canChangePassword() && !auth.mustChangePassword()) {
            <button type="button" class="btn btn-secondary btn-sm" data-change-password (click)="passwordOpen.set(true)" title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
              <span class="hidden sm:inline">Contraseña</span>
            </button>
          }
          <a routerLink="/" class="btn btn-secondary btn-sm" data-exit title="Salir del panel sin cerrar la sesión" aria-label="Salir del panel sin cerrar la sesión">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>
            <span class="hidden sm:inline">Ir al inicio</span>
          </a>
          <button type="button" class="btn btn-secondary btn-sm" data-logout (click)="logout()" title="Cerrar la sesión de superadmin" aria-label="Cerrar sesión de superadmin">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>
            <span class="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-6xl p-4 sm:p-6 md:p-8 space-y-6">
        <section aria-label="Resumen" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-stats>
          @for (item of statItems(); track item.label; let last = $last) {
            <div [class]="last ? 'card p-4 col-span-2 sm:col-span-1' : 'card p-4'">
              <p class="text-xs font-bold uppercase tracking-wider text-muted">{{ item.label }}</p>
              <p class="mt-1 font-display text-3xl font-black" [class.text-danger]="item.tone === 'danger'">{{ item.value }}</p>
            </div>
          }
        </section>

        @if (auth.owner()) {
          <app-tabs [tabs]="scopeItems" label="Cuenta que estás revisando" [selected]="api.scope()" (selectedChange)="selectScope($event)" data-scope />
          @if (api.scope() === 'others') {
            <p class="rounded-ui-md bg-surface-2 px-4 py-3 text-sm font-bold" data-scope-note>Estás viendo lo que gestiona el otro administrador: sus negocios, códigos y actividad. Esto no se mezcla con lo tuyo.</p>
          }
        }
        <app-tabs [tabs]="tabItems()" label="Secciones del panel" [selected]="tab()" (selectedChange)="selectTab($event)" />

        @if (tab() === 'tenants') {
          <section aria-label="Negocios" class="space-y-4">
            <div class="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <input type="search" class="input md:max-w-sm" placeholder="Buscar por negocio, dirección o correo" aria-label="Buscar negocios"
                     data-search [ngModel]="query()" (ngModelChange)="onSearch($event)">
              <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
                @for (option of filters; track option.id) {
                  <button type="button" class="btn btn-sm" [class.btn-primary]="status() === option.id" [class.btn-secondary]="status() !== option.id"
                          [attr.aria-pressed]="status() === option.id" [attr.data-filter]="option.id" (click)="setStatus(option.id)">{{ option.label }}</button>
                }
              </div>
            </div>

            @if (error()) {
              <div class="card p-5 text-center" role="alert">
                <p class="font-bold text-danger">{{ error() }}</p>
                <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="load()">Reintentar</button>
              </div>
            } @else if (loading() && !page()) {
              <div class="space-y-3" aria-hidden="true"><div class="skeleton h-14"></div><div class="skeleton h-14"></div><div class="skeleton h-14"></div></div>
            } @else if (page(); as data) {
              @if (data.content.length === 0) {
                <app-empty-state title="Sin resultados" text="Ningún negocio coincide con la búsqueda o el filtro." />
              } @else {
                <div class="hidden md:block card overflow-hidden" [class.opacity-60]="loading()">
                  <table class="w-full text-left text-sm" data-table>
                    <thead class="bg-surface-2 text-xs uppercase tracking-wider text-muted">
                      <tr>
                        <th scope="col" class="px-4 py-3">Negocio</th>
                        <th scope="col" class="px-4 py-3">Dueño</th>
                        <th scope="col" class="px-4 py-3">Estado</th>
                        <th scope="col" class="px-4 py-3">Plan</th>
                        <th scope="col" class="px-4 py-3">Alta</th>
                        <th scope="col" class="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                      @for (tenant of data.content; track tenant.id) {
                        <tr data-row [attr.data-slug]="tenant.slug">
                          <td class="px-4 py-3 align-top">
                            <p class="font-bold">{{ tenant.name }}</p>
                            <a [href]="'/' + tenant.slug" target="_blank" rel="noopener" class="text-xs font-medium text-primary hover:underline">/{{ tenant.slug }}</a>
                          </td>
                          <td class="px-4 py-3 align-top break-all">
                            {{ tenant.ownerEmail ?? '—' }}
                            @if (tenant.editors > 0) { <span class="block text-xs text-muted">+ {{ tenant.editors }} editor{{ tenant.editors === 1 ? '' : 'es' }}</span> }
                          </td>
                          <td class="px-4 py-3 align-top"><ng-container *ngTemplateOutlet="badges; context: { $implicit: tenant }" /></td>
                          <td class="px-4 py-3 align-top whitespace-nowrap" data-plan>
                            @if (tenant.planExpiresAt) { <span [class.text-danger]="tenant.planStatus === 'EXPIRED'" class="font-medium">{{ tenant.planStatus === 'EXPIRED' ? 'Venció' : 'Vence' }} {{ tenant.planExpiresAt | date: 'dd/MM/yyyy' }}</span> } @else { <span class="text-muted">Sin vencimiento</span> }
                          </td>
                          <td class="px-4 py-3 align-top whitespace-nowrap text-muted">{{ tenant.createdAt | date: 'dd/MM/yyyy' }}</td>
                          <td class="px-4 py-3 align-top"><div class="flex justify-end gap-2"><ng-container *ngTemplateOutlet="actions; context: { $implicit: tenant }" /></div></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <ul class="md:hidden space-y-3" data-cards [class.opacity-60]="loading()">
                  @for (tenant of data.content; track tenant.id) {
                    <li class="card p-4" data-row [attr.data-slug]="tenant.slug">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="font-bold break-words">{{ tenant.name }}</p>
                          <a [href]="'/' + tenant.slug" target="_blank" rel="noopener" class="text-xs font-medium text-primary">/{{ tenant.slug }}</a>
                        </div>
                        <ng-container *ngTemplateOutlet="badges; context: { $implicit: tenant }" />
                      </div>
                      <p class="mt-2 text-sm break-all">{{ tenant.ownerEmail ?? '—' }}</p>
                      <p class="text-xs font-medium" data-plan [class.text-danger]="tenant.planStatus === 'EXPIRED'">{{ tenant.planExpiresAt ? (tenant.planStatus === 'EXPIRED' ? 'Plan vencido el ' : 'Plan hasta el ') + (tenant.planExpiresAt | date: 'dd/MM/yyyy') : 'Sin vencimiento' }}</p>
                      <p class="text-xs text-muted">Alta {{ tenant.createdAt | date: 'dd/MM/yyyy' }}@if (tenant.editors > 0) { · + {{ tenant.editors }} editor{{ tenant.editors === 1 ? '' : 'es' }} }</p>
                      <div class="mt-3 flex flex-wrap gap-2"><ng-container *ngTemplateOutlet="actions; context: { $implicit: tenant }" /></div>
                    </li>
                  }
                </ul>

                <div class="flex items-center justify-between gap-3" data-pager>
                  <p class="text-sm font-medium text-muted">{{ data.totalElements }} negocio{{ data.totalElements === 1 ? '' : 's' }} · página {{ data.page + 1 }} de {{ data.totalPages || 1 }}</p>
                  <div class="flex gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" data-prev [disabled]="data.page === 0 || loading()" (click)="goTo(data.page - 1)">Anterior</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-next [disabled]="data.page + 1 >= data.totalPages || loading()" (click)="goTo(data.page + 1)">Siguiente</button>
                  </div>
                </div>
              }
            }
          </section>
        } @else if (tab() === 'codes') {
          <app-superadmin-codes />
        } @else {
          <section aria-label="Actividad" class="space-y-3" data-activity>
            @if (audit(); as entries) {
              @if (entries.length === 0) {
                <app-empty-state title="Sin actividad" text="Aquí aparecerán las suspensiones, reactivaciones y eliminaciones." />
              } @else {
                <ul class="card divide-y divide-line">
                  @for (entry of entries; track entry.id) {
                    <li class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div class="min-w-0">
                        <p class="font-bold"><span class="badge" [class.badge-danger]="entry.action === 'TENANT_DELETED'" [class.badge-warning]="entry.action === 'TENANT_SUSPENDED'" [class.badge-success]="entry.action === 'TENANT_ACTIVATED'">{{ actionLabel(entry.action) }}</span> {{ entry.targetLabel }}</p>
                        @if (entry.detail) { <p class="text-xs text-muted">{{ entry.detail }}</p> }
                      </div>
                      <p class="text-xs font-medium text-muted shrink-0">{{ entry.at | date: 'dd/MM/yyyy HH:mm' }}@if (entry.ip) { · {{ entry.ip }} }</p>
                    </li>
                  }
                </ul>
              }
            } @else {
              <div class="skeleton h-14" aria-hidden="true"></div>
            }
          </section>
        }
      </main>
    </div>

    <ng-template #badges let-tenant>
      <div class="flex flex-wrap gap-1.5 shrink-0">
        @if (tenant.suspended) { <span class="badge badge-danger">Suspendido</span> } @else { <span class="badge badge-success">Activo</span> }
        @if (tenant.published) { <span class="badge">Publicado</span> } @else { <span class="badge">Borrador</span> }
        @if (!tenant.ownerVerified) { <span class="badge badge-warning">Sin verificar</span> }
      </div>
    </ng-template>

    <ng-template #actions let-tenant>
      @if (!auth.isAdmin()) {
        <span class="text-xs font-medium text-muted" data-read-only>Solo lectura</span>
      } @else if (tenant.suspended) {
        <button type="button" class="btn btn-secondary btn-sm" data-activate (click)="ask('activate', tenant)">Reactivar</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete (click)="ask('delete', tenant)">Eliminar</button>
      } @else {
        <button type="button" class="btn btn-secondary btn-sm" data-suspend (click)="ask('suspend', tenant)">Suspender</button>
        <button type="button" class="btn btn-secondary btn-sm opacity-50" disabled data-delete-locked title="Suspende el negocio antes de eliminarlo">Eliminar</button>
      }
    </ng-template>

    @if (auth.mustChangePassword() || passwordOpen()) {
      <app-modal [heading]="auth.mustChangePassword() ? 'Crea tu contraseña' : 'Cambiar contraseña'" size="sm"
                 [dismissable]="!auth.mustChangePassword() && !passwordBusy()" (closed)="closePassword()">
        <form id="sa-password-form" class="space-y-4" (submit)="changePassword($event)" data-password-form>
          @if (auth.mustChangePassword()) {
            <p class="font-medium text-muted">Tu contraseña es temporal. Elige una nueva para entrar al panel.</p>
          }
          <div>
            <label for="sa-pw-current" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña actual</label>
            <input id="sa-pw-current" type="password" class="input mt-2" autocomplete="current-password" data-pw-current [ngModel]="pwCurrent()" (ngModelChange)="pwCurrent.set($event)" name="current">
          </div>
          <div>
            <label for="sa-pw-next" class="text-xs font-bold uppercase tracking-wider text-muted">Contraseña nueva (mínimo 10 caracteres)</label>
            <input id="sa-pw-next" type="password" class="input mt-2" autocomplete="new-password" data-pw-next [ngModel]="pwNext()" (ngModelChange)="pwNext.set($event)" name="next">
          </div>
          <div>
            <label for="sa-pw-repeat" class="text-xs font-bold uppercase tracking-wider text-muted">Repite la contraseña nueva</label>
            <input id="sa-pw-repeat" type="password" class="input mt-2" autocomplete="new-password" data-pw-repeat [ngModel]="pwRepeat()" (ngModelChange)="pwRepeat.set($event)" name="repeat">
          </div>
          @if (passwordError()) { <p role="alert" class="text-sm font-bold text-danger" data-pw-error>{{ passwordError() }}</p> }
        </form>
        <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          @if (!auth.mustChangePassword()) {
            <button type="button" class="btn btn-secondary" data-cancel [disabled]="passwordBusy()" (click)="closePassword()">Cancelar</button>
          } @else {
            <button type="button" class="btn btn-secondary" data-logout-forced [disabled]="passwordBusy()" (click)="logout()">Salir</button>
          }
          <button type="submit" form="sa-password-form" class="btn btn-primary" data-pw-save [disabled]="passwordBusy()">{{ passwordBusy() ? 'Guardando…' : 'Guardar contraseña' }}</button>
        </div>
      </app-modal>
    }

    @if (action(); as current) {
      @if (current.kind === 'delete') {
        <app-modal heading="Eliminar negocio" size="sm" [dismissable]="!busy()" (closed)="cancel()">
          <p class="font-medium text-muted">
            Se borrarán <strong class="text-ink">{{ current.tenant.name }}</strong>, su carta, sus fotos y sus usuarios. <strong class="text-danger">No se puede deshacer.</strong>
          </p>
          <label for="sa-confirm" class="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Escribe <span class="text-ink normal-case">{{ current.tenant.slug }}</span> para confirmar</label>
          <input id="sa-confirm" class="input mt-2" autocomplete="off" autocapitalize="off" spellcheck="false" data-confirm-slug [ngModel]="typed()" (ngModelChange)="typed.set($event)">
          @if (actionError()) { <p role="alert" class="mt-3 text-sm font-bold text-danger">{{ actionError() }}</p> }
          <div modal-footer class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" class="btn btn-secondary" data-cancel [disabled]="busy()" (click)="cancel()">Cancelar</button>
            <button type="button" class="btn btn-danger" data-confirm [disabled]="busy() || typed().trim() !== current.tenant.slug" (click)="confirm()">{{ busy() ? 'Eliminando…' : 'Eliminar definitivamente' }}</button>
          </div>
        </app-modal>
      } @else {
        <app-confirm-dialog
          [title]="current.kind === 'suspend' ? 'Suspender negocio' : 'Reactivar negocio'"
          [message]="current.kind === 'suspend'
            ? current.tenant.name + ' dejará de verse al público y su dueño no podrá iniciar sesión; sus sesiones abiertas se cerrarán. No se borra nada y puedes reactivarlo cuando quieras.'
            : current.tenant.name + ' volverá a estar activo: su dueño podrá entrar y su sitio se verá como estaba.'"
          [confirmLabel]="current.kind === 'suspend' ? 'Suspender' : 'Reactivar'" busyLabel="Procesando…"
          [tone]="current.kind === 'suspend' ? 'danger' : 'primary'" [busy]="busy()" (confirmed)="confirm()" (cancelled)="cancel()" />
      }
    }
  `,
})
export class SuperAdminPage implements OnInit, OnDestroy {
  protected readonly auth = inject(SuperAdminAuth);
  protected readonly api = inject(SuperAdminApi);
  private readonly router = inject(Router);
  private readonly notices = inject(NoticeService);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;

  protected readonly tabItems = computed(() => this.auth.isAdmin()
    ? [{ id: 'tenants', label: 'Negocios' }, { id: 'codes', label: 'Códigos' }, { id: 'activity', label: 'Actividad' }]
    : [{ id: 'tenants', label: 'Negocios' }, { id: 'activity', label: 'Actividad' }]);
  protected readonly filters: { id: TenantStatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'Activos' },
    { id: 'suspended', label: 'Suspendidos' },
  ];

  protected readonly scopeItems = [{ id: 'mine', label: 'Mi cuenta' }, { id: 'others', label: 'Otro administrador' }];
  protected readonly tab = signal<'tenants' | 'codes' | 'activity'>('tenants');
  protected readonly stats = signal<SuperAdminStats | null>(null);
  protected readonly page = signal<SuperAdminTenantPage | null>(null);
  protected readonly audit = signal<SuperAdminAudit[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly status = signal<TenantStatusFilter>('all');
  protected readonly action = signal<Action | null>(null);
  protected readonly busy = signal(false);
  protected readonly typed = signal('');
  protected readonly actionError = signal<string | null>(null);
  protected readonly passwordOpen = signal(false);
  protected readonly passwordBusy = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly pwCurrent = signal('');
  protected readonly pwNext = signal('');
  protected readonly pwRepeat = signal('');

  ngOnInit(): void {
    if (!this.auth.mustChangePassword()) {
      void this.load();
      void this.loadStats();
    }
    this.poll = setInterval(() => {
      if (this.tab() === 'tenants' && document.visibilityState === 'visible' && !this.action() && !this.loading()
          && !this.auth.mustChangePassword()) {
        void this.load(undefined, true);
        void this.loadStats();
      }
    }, POLL_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearInterval(this.poll);
  }

  protected statItems(): { label: string; value: number | string; tone?: 'danger' }[] {
    const s = this.stats();
    return [
      { label: 'Negocios', value: s?.total ?? '—' },
      { label: 'Activos', value: s?.active ?? '—' },
      { label: 'Suspendidos', value: s?.suspended ?? '—', tone: s && s.suspended > 0 ? 'danger' : undefined },
      { label: 'Publicados', value: s?.published ?? '—' },
      { label: 'Nuevos (7 días)', value: s?.newLast7Days ?? '—' },
    ];
  }

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  protected closePassword(): void {
    if (this.auth.mustChangePassword() || this.passwordBusy()) {
      return;
    }
    this.passwordOpen.set(false);
    this.resetPasswordForm();
  }

  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwordBusy()) {
      return;
    }
    if (this.pwNext().length < 10) {
      this.passwordError.set('La contraseña nueva debe tener al menos 10 caracteres.');
      return;
    }
    if (this.pwNext() !== this.pwRepeat()) {
      this.passwordError.set('Las contraseñas nuevas no coinciden.');
      return;
    }
    this.passwordBusy.set(true);
    this.passwordError.set(null);
    const wasForced = this.auth.mustChangePassword();
    try {
      await this.auth.changePassword(this.pwCurrent(), this.pwNext());
      this.passwordOpen.set(false);
      this.resetPasswordForm();
      this.notices.show('info', 'Contraseña actualizada.');
      if (wasForced) {
        void this.load();
        void this.loadStats();
      }
    } catch (error) {
      const problem = toProblem(error);
      this.passwordError.set(problem.code === 'wrong_password' ? 'La contraseña actual no es correcta.'
        : problem.code === 'weak_password' ? 'Usa al menos 10 caracteres y una contraseña distinta de la actual.'
        : isConnectionProblem(problem) ? 'Problema de conexión. Inténtalo de nuevo.' : 'No se pudo cambiar la contraseña.');
    } finally {
      this.passwordBusy.set(false);
    }
  }

  private resetPasswordForm(): void {
    this.pwCurrent.set('');
    this.pwNext.set('');
    this.pwRepeat.set('');
    this.passwordError.set(null);
  }

  protected selectScope(id: string): void {
    const next = id === 'others' ? 'others' : 'mine';
    if (!this.auth.owner() || next === this.api.scope()) {
      return;
    }
    this.api.scope.set(next);
    this.tab.set('tenants');
    this.audit.set(null);
    this.page.set(null);
    void this.load(0);
    void this.loadStats();
  }

  protected selectTab(id: string): void {
    if (id === 'codes' && !this.auth.isAdmin()) {
      return;
    }
    this.tab.set(id === 'activity' ? 'activity' : id === 'codes' ? 'codes' : 'tenants');
    if (this.tab() === 'activity') {
      void this.loadAudit();
    }
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.load(0), 300);
  }

  protected setStatus(status: TenantStatusFilter): void {
    this.status.set(status);
    void this.load(0);
  }

  protected goTo(index: number): void {
    void this.load(index);
  }

  protected async load(index = this.page()?.page ?? 0, silent = false): Promise<void> {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    try {
      this.page.set(await firstValueFrom(this.api.tenants(this.query(), this.status(), index)));
    } catch (error) {
      if (silent && this.page()) {
        return;
      }
      this.error.set(this.failure(error, 'No pudimos cargar los negocios.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected ask(kind: Action['kind'], tenant: SuperAdminTenant): void {
    this.typed.set('');
    this.actionError.set(null);
    this.action.set({ kind, tenant });
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
    this.actionError.set(null);
    try {
      const { kind, tenant } = current;
      if (kind === 'suspend') {
        await firstValueFrom(this.api.suspend(tenant.id));
      } else if (kind === 'activate') {
        await firstValueFrom(this.api.activate(tenant.id));
      } else {
        await firstValueFrom(this.api.remove(tenant.id, this.typed().trim()));
      }
      this.action.set(null);
      this.notices.show('info', { suspend: 'Negocio suspendido.', activate: 'Negocio reactivado.', delete: 'Negocio eliminado.' }[kind]);
      void this.load();
      void this.loadStats();
      this.audit.set(null);
    } catch (error) {
      this.actionError.set(this.failure(error, 'No se pudo completar la acción.'));
      if (current.kind !== 'delete') {
        this.notices.show('error', this.actionError() ?? 'No se pudo completar la acción.');
        this.action.set(null);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(await firstValueFrom(this.api.stats()));
    } catch {
      this.stats.set(null);
    }
  }

  private async loadAudit(): Promise<void> {
    if (this.audit()) {
      return;
    }
    try {
      this.audit.set(await firstValueFrom(this.api.audit()));
    } catch {
      this.audit.set([]);
    }
  }

  private failure(error: unknown, fallback: string): string {
    const problem = toProblem(error);
    if (problem.code === 'not_suspended') {
      return 'Suspende el negocio antes de eliminarlo.';
    }
    if (problem.code === 'slug_mismatch') {
      return 'La dirección escrita no coincide.';
    }
    return isConnectionProblem(problem) ? 'Problema de conexión. Inténtalo de nuevo.' : fallback;
  }
}
