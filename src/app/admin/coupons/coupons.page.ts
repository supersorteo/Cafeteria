import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Coupon, CouponPayload, CouponStatus, CouponType } from '../../core/coupons.api';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Modal } from '../../shared/ui/modal';
import { CouponsStore } from './coupons.store';

const COUPON_TYPES: { value: CouponType; label: string }[] = [
  { value: 'DESCUENTO', label: 'Descuento' },
  { value: 'VIGENCIA', label: 'Vigencia' },
  { value: 'CAMBIO', label: 'Cambio' },
  { value: 'REGALO', label: 'Regalo' },
  { value: 'OTRO', label: 'Otro' },
];

const STATUS_LABELS: Record<CouponStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SCHEDULED: 'Programado',
  EXPIRED: 'Vencido',
  EXHAUSTED: 'Agotado',
};

const WEEKDAYS = [
  { value: '1', label: 'L', name: 'lunes' },
  { value: '2', label: 'M', name: 'martes' },
  { value: '3', label: 'X', name: 'miércoles' },
  { value: '4', label: 'J', name: 'jueves' },
  { value: '5', label: 'V', name: 'viernes' },
  { value: '6', label: 'S', name: 'sábado' },
  { value: '7', label: 'D', name: 'domingo' },
];

@Component({
  imports: [FormsModule, ConfirmDialog, Modal],
  selector: 'app-coupons-page',
  providers: [CouponsStore],
  template: `
    <section class="max-w-7xl mx-auto">
      <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.18em] text-primary">Promociones del negocio</p>
          <h1 class="mt-2 font-display text-3xl md:text-4xl font-black">Cupones</h1>
          <p class="mt-3 max-w-2xl text-base font-medium text-muted">Crea beneficios para tus clientes y muéstralos en tu sitio con un diseño tipo boleto.</p>
        </div>
        <button type="button" class="btn btn-primary" data-create (click)="openCreate()" [disabled]="store.locked()">+ Crear cupón</button>
      </header>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-ui-lg border border-line bg-surface-2/60 px-4 py-3" data-usage>
        <p class="text-sm font-bold">{{ store.counted() }} de {{ store.maxActive() }} cupones activos</p>
        <p class="text-xs font-semibold text-muted">{{ store.coupons().length }} {{ store.coupons().length === 1 ? 'guardado' : 'guardados' }} · los vencidos y apagados no cuentan</p>
      </div>
      @if (nearLimit()) {
        <p class="mt-3 rounded-ui-md bg-warning/10 px-4 py-3 text-sm font-bold" data-near-limit>
          Estás cerca del límite de tu plan. Con el plan Profesional puedes tener más cupones activos a la vez.
        </p>
      }

      @switch (store.state()) {
        @case ('loading') {
          <div class="mt-6 skeleton h-48" aria-hidden="true"></div>
        }
        @case ('error') {
          <div class="card mt-6 p-6 text-center" role="alert">
            <p class="font-bold text-danger">No pudimos cargar tus cupones.</p>
            <button type="button" class="btn btn-secondary btn-sm mt-3" data-retry (click)="store.load()">Reintentar</button>
          </div>
        }
        @default {
          @if (store.coupons().length === 0) {
            <div class="card mt-6 p-8 text-center">
              <div class="coupon-empty-icon mx-auto">%</div>
              <h2 class="mt-4 font-display text-2xl font-black">Aún no tienes cupones</h2>
              <p class="mx-auto mt-2 max-w-md text-sm font-medium text-muted">Crea tu primer cupón para ofrecer descuentos, regalos o beneficios especiales.</p>
              <button type="button" class="btn btn-primary mt-5" (click)="openCreate()" [disabled]="store.locked()">Crear mi primer cupón</button>
            </div>
          } @else {
            <div class="mt-6 grid gap-6 xl:grid-cols-2">
              @for (coupon of store.coupons(); track coupon.id) {
                <article class="coupon-ticket" [class.coupon-ticket-inactive]="!coupon.counted" data-coupon [attr.data-code]="coupon.code">
                  <div class="coupon-ticket-main">
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <span class="coupon-ticket-type">{{ coupon.type }}</span>
                        @if (coupon.featured) { <span class="coupon-ticket-type ml-2">Destacado</span> }
                        <h2 class="mt-3 font-display text-2xl font-black break-words">{{ coupon.title }}</h2>
                      </div>
                      <button type="button" class="coupon-status shrink-0" [class.active]="coupon.active" data-toggle [disabled]="store.locked() || store.busy()"
                              [attr.aria-pressed]="coupon.active" [attr.aria-label]="(coupon.active ? 'Desactivar el cupón ' : 'Activar el cupón ') + coupon.code" (click)="toggle(coupon)">
                        {{ statusLabel(coupon) }}
                      </button>
                    </div>
                    <p class="mt-3 text-sm font-semibold opacity-80">{{ coupon.benefit }}</p>
                    <div class="coupon-ticket-code-wrap mt-6">
                      <span class="text-xs font-bold uppercase tracking-widest opacity-70">Código cupón</span>
                      <strong class="coupon-ticket-code">{{ coupon.code }}</strong>
                    </div>
                    <p class="mt-4 text-xs font-bold uppercase tracking-wider opacity-70">{{ validityLine(coupon) }}</p>
                    @if (coupon.maxRedemptions !== null) {
                      <p class="mt-1 text-xs font-bold uppercase tracking-wider opacity-70" data-redemptions>Canjes: {{ coupon.redemptions }} de {{ coupon.maxRedemptions }}</p>
                    } @else if (coupon.redemptions > 0) {
                      <p class="mt-1 text-xs font-bold uppercase tracking-wider opacity-70" data-redemptions>Canjes: {{ coupon.redemptions }}</p>
                    }
                  </div>
                  <div class="coupon-ticket-actions">
                    @if (store.advanced()) {
                      <button type="button" class="icon-btn !h-11 !w-11" data-redeem [disabled]="store.locked() || store.busy()" (click)="redeem(coupon)" [attr.aria-label]="'Registrar un canje del cupón ' + coupon.code">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                      </button>
                    }
                    <button type="button" class="icon-btn !h-11 !w-11" data-edit [disabled]="store.locked()" (click)="openEdit(coupon)" [attr.aria-label]="'Editar el cupón ' + coupon.code">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
                    </button>
                    <button type="button" class="icon-btn !h-11 !w-11 !text-danger" data-delete [disabled]="store.locked()" (click)="pendingDelete.set(coupon)" [attr.aria-label]="'Eliminar el cupón ' + coupon.code">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                    </button>
                  </div>
                </article>
              }
            </div>
          }
        }
      }
      @if (actionError() && !editorOpen()) { <p role="alert" class="mt-4 text-sm font-bold text-danger" data-action-error>{{ actionError() }}</p> }
    </section>

    @if (editorOpen()) {
      <app-modal [heading]="editing() ? 'Editar cupón' : 'Crear cupón'" size="md" (closed)="closeEditor()">
        <form id="coupon-form" class="space-y-5" (submit)="save($event)">
          <div class="grid gap-5 sm:grid-cols-2">
            <label class="coupon-field sm:col-span-2"><span>Código del cupón</span><input class="input" maxlength="24" data-code [value]="code()" (input)="code.set(value($event).toUpperCase())" placeholder="BIENVENIDA20" autocomplete="off"></label>
            <label class="coupon-field"><span>Tipo de cupón</span><select class="input" data-type [value]="type()" (change)="setType($event)">@for (option of types; track option.value) {<option [value]="option.value" [selected]="option.value === type()">{{ option.label }}</option>}</select></label>
            <label class="coupon-field"><span>Estado</span><select class="input" data-active (change)="active.set(value($event) === 'true')"><option value="true" [selected]="active()">Activo</option><option value="false" [selected]="!active()">Inactivo</option></select></label>
            <label class="coupon-field sm:col-span-2"><span>Título</span><input class="input" maxlength="80" data-title [value]="title()" (input)="title.set(value($event))" placeholder="20% de descuento"></label>
            <label class="coupon-field sm:col-span-2"><span>Beneficio o condición</span><textarea class="input resize-none" rows="2" maxlength="180" data-benefit [value]="benefit()" (input)="benefit.set(value($event))" placeholder="Válido en consumos superiores a $20.000"></textarea></label>
            <label class="coupon-field"><span>Empieza el (opcional)</span><input class="input" type="date" data-starts [value]="startsOn()" (input)="startsOn.set(value($event))"></label>
            <label class="coupon-field"><span>Termina el (opcional)</span><input class="input" type="date" data-ends [value]="endsOn()" (input)="endsOn.set(value($event))"></label>
            <label class="coupon-field sm:col-span-2"><span>Texto de vigencia (opcional)</span><input class="input" maxlength="80" data-validity [value]="validity()" (input)="validity.set(value($event))" placeholder="Solo en la cena"></label>
          </div>

          <fieldset class="rounded-ui-lg border border-line p-4" [disabled]="!store.advanced()" data-advanced>
            <legend class="px-2 text-xs font-bold uppercase tracking-wider text-muted">Opciones del plan Profesional</legend>
            @if (!store.advanced()) {
              <p class="mb-3 text-sm font-bold" data-advanced-locked>Días, horario, límite de usos y cupón destacado están disponibles en el plan Profesional.</p>
            }
            <div class="coupon-field">
              <span>Días de la semana (vacío = todos)</span>
              <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
                @for (day of weekdays; track day.value) {
                  <button type="button" class="qr-choice !min-h-11 !min-w-11" [class.active]="hasDay(day.value)" [attr.aria-pressed]="hasDay(day.value)"
                          [attr.aria-label]="day.name" (click)="toggleDay(day.value)">{{ day.label }}</button>
                }
              </div>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="coupon-field"><span>Desde la hora</span><input class="input" type="time" data-time-from [value]="timeFrom()" (input)="timeFrom.set(value($event))"></label>
              <label class="coupon-field"><span>Hasta la hora</span><input class="input" type="time" data-time-to [value]="timeTo()" (input)="timeTo.set(value($event))"></label>
              <label class="coupon-field"><span>Límite de usos (opcional)</span><input class="input" type="number" min="1" inputmode="numeric" data-max [value]="maxRedemptions()" (input)="maxRedemptions.set(value($event))" placeholder="Ej. 50"></label>
              <label class="flex items-center gap-2 self-end text-sm font-bold"><input type="checkbox" class="h-4 w-4" data-featured [checked]="featured()" (change)="featured.set($any($event.target).checked)"> Cupón destacado</label>
            </div>
          </fieldset>
          @if (error()) { <p role="alert" class="text-sm font-bold text-danger" data-error>{{ error() }}</p> }
        </form>
        <div modal-footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-secondary" data-cancel (click)="closeEditor()">Cancelar</button>
          <button type="submit" form="coupon-form" class="btn btn-primary" data-save [disabled]="store.busy()">{{ store.busy() ? 'Guardando…' : (editing() ? 'Guardar cambios' : 'Crear cupón') }}</button>
        </div>
      </app-modal>
    }

    @if (pendingDelete(); as coupon) {
      <app-confirm-dialog title="Eliminar cupón" [message]="'¿Eliminar el cupón «' + coupon.code + '»? Esta acción no se puede deshacer.'" busyLabel="Eliminando…" [busy]="store.busy()" (confirmed)="remove(coupon)" (cancelled)="pendingDelete.set(null)" />
    }
  `,
})
export class CouponsPage implements OnInit {
  protected readonly store = inject(CouponsStore);
  protected readonly types = COUPON_TYPES;
  protected readonly weekdays = WEEKDAYS;
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Coupon | null>(null);
  protected readonly pendingDelete = signal<Coupon | null>(null);
  protected readonly code = signal('');
  protected readonly type = signal<CouponType>('DESCUENTO');
  protected readonly title = signal('');
  protected readonly benefit = signal('');
  protected readonly validity = signal('');
  protected readonly startsOn = signal('');
  protected readonly endsOn = signal('');
  protected readonly days = signal('');
  protected readonly timeFrom = signal('');
  protected readonly timeTo = signal('');
  protected readonly maxRedemptions = signal('');
  protected readonly featured = signal(false);
  protected readonly active = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly nearLimit = computed(() => this.store.maxActive() > 0 && this.store.counted() >= Math.ceil(this.store.maxActive() * 0.8));

  ngOnInit(): void {
    void this.store.load();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected setType(event: Event): void {
    this.type.set(this.value(event) as CouponType);
  }

  protected statusLabel(coupon: Coupon): string {
    return STATUS_LABELS[coupon.status];
  }

  protected validityLine(coupon: Coupon): string {
    const parts: string[] = [];
    if (coupon.startsOn || coupon.endsOn) {
      parts.push([coupon.startsOn ? `Desde ${this.date(coupon.startsOn)}` : '', coupon.endsOn ? `hasta ${this.date(coupon.endsOn)}` : ''].filter(Boolean).join(' '));
    }
    if (coupon.validityText) {
      parts.push(coupon.validityText);
    }
    return parts.join(' · ') || 'Sin fecha de vencimiento';
  }

  protected hasDay(day: string): boolean {
    return this.days().includes(day);
  }

  protected toggleDay(day: string): void {
    this.days.update(current => (current.includes(day) ? current.replace(day, '') : [...current, day].sort().join('')));
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.code.set('');
    this.type.set('DESCUENTO');
    this.title.set('');
    this.benefit.set('');
    this.validity.set('');
    this.startsOn.set('');
    this.endsOn.set('');
    this.days.set('');
    this.timeFrom.set('');
    this.timeTo.set('');
    this.maxRedemptions.set('');
    this.featured.set(false);
    this.active.set(true);
    this.error.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(coupon: Coupon): void {
    this.editing.set(coupon);
    this.code.set(coupon.code);
    this.type.set(coupon.type);
    this.title.set(coupon.title);
    this.benefit.set(coupon.benefit);
    this.validity.set(coupon.validityText ?? '');
    this.startsOn.set(coupon.startsOn ?? '');
    this.endsOn.set(coupon.endsOn ?? '');
    this.days.set(coupon.weekdays ?? '');
    this.timeFrom.set(coupon.timeFrom?.slice(0, 5) ?? '');
    this.timeTo.set(coupon.timeTo?.slice(0, 5) ?? '');
    this.maxRedemptions.set(coupon.maxRedemptions === null ? '' : String(coupon.maxRedemptions));
    this.featured.set(coupon.featured);
    this.active.set(coupon.active);
    this.error.set(null);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    if (this.store.busy()) {
      return;
    }
    this.editorOpen.set(false);
    this.editing.set(null);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.store.busy()) {
      return;
    }
    const code = this.code().trim().toUpperCase();
    const title = this.title().trim();
    const benefit = this.benefit().trim();
    if (!code || !title || !benefit) {
      this.error.set('Completa el código, el título y el beneficio del cupón.');
      return;
    }
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      this.error.set('El código usa de 3 a 24 letras, números o guiones.');
      return;
    }
    if (this.startsOn() && this.endsOn() && this.endsOn() < this.startsOn()) {
      this.error.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    if (!!this.timeFrom() !== !!this.timeTo()) {
      this.error.set('Indica la hora de inicio y la de fin, o deja ambas vacías.');
      return;
    }
    const advanced = this.store.advanced();
    const max = Number(this.maxRedemptions());
    const payload: CouponPayload = {
      code,
      type: this.type(),
      title,
      benefit,
      validityText: this.validity().trim() || null,
      startsOn: this.startsOn() || null,
      endsOn: this.endsOn() || null,
      weekdays: advanced && this.days() ? this.days() : null,
      timeFrom: advanced ? this.timeFrom() || null : null,
      timeTo: advanced ? this.timeTo() || null : null,
      maxRedemptions: advanced && this.maxRedemptions() && max >= 1 ? Math.floor(max) : null,
      featured: advanced && this.featured(),
      active: this.active(),
      version: this.editing()?.version ?? null,
    };
    const current = this.editing();
    const failure = current ? await this.store.update(current.id, payload) : await this.store.create(payload);
    if (failure) {
      this.error.set(failure);
      return;
    }
    this.editorOpen.set(false);
    this.editing.set(null);
  }

  protected async toggle(coupon: Coupon): Promise<void> {
    this.actionError.set(await this.store.toggle(coupon));
  }

  protected async redeem(coupon: Coupon): Promise<void> {
    this.actionError.set(await this.store.redeem(coupon));
  }

  protected async remove(coupon: Coupon): Promise<void> {
    this.actionError.set(await this.store.remove(coupon.id));
    this.pendingDelete.set(null);
  }

  private date(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
}
