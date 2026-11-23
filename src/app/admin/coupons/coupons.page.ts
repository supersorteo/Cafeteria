import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Modal } from '../../shared/ui/modal';
import { Coupon, CouponType, CouponsStore } from './coupons.store';

const COUPON_TYPES: { value: CouponType; label: string }[] = [
  { value: 'DESCUENTO', label: 'Descuento' },
  { value: 'VIGENCIA', label: 'Vigencia' },
  { value: 'CAMBIO', label: 'Cambio' },
  { value: 'REGALO', label: 'Regalo' },
  { value: 'OTRO', label: 'Otro' },
];

@Component({
  imports: [FormsModule, ConfirmDialog, Modal],
  selector: 'app-coupons-page',
  template: `
    <section class="max-w-7xl mx-auto">
      <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.18em] text-primary">Promociones del negocio</p>
          <h1 class="mt-2 font-display text-3xl md:text-4xl font-black">Cupones</h1>
          <p class="mt-3 max-w-2xl text-base font-medium text-muted">Crea beneficios para tus clientes y muéstralos en tu sitio con un diseño tipo boleto.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreate()" [disabled]="store.coupons().length >= store.maxCoupons">+ Crear cupón</button>
      </header>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-ui-lg border border-line bg-surface-2/60 px-4 py-3">
        <p class="text-sm font-bold">{{ store.coupons().length }} de {{ store.maxCoupons }} cupones creados</p>
        <p class="text-xs font-semibold text-muted">{{ store.activeCoupons().length }} activos · {{ store.coupons().length - store.activeCoupons().length }} inactivos</p>
      </div>

      @if (store.coupons().length === 0) {
        <div class="card mt-6 p-8 text-center">
          <div class="coupon-empty-icon mx-auto">%</div>
          <h2 class="mt-4 font-display text-2xl font-black">Aún no tienes cupones</h2>
          <p class="mx-auto mt-2 max-w-md text-sm font-medium text-muted">Crea tu primer cupón para ofrecer descuentos, regalos o beneficios especiales.</p>
          <button type="button" class="btn btn-primary mt-5" (click)="openCreate()">Crear mi primer cupón</button>
        </div>
      } @else {
        <div class="mt-6 grid gap-6 xl:grid-cols-2">
          @for (coupon of store.coupons(); track coupon.id) {
            <article class="coupon-ticket" [class.coupon-ticket-inactive]="!coupon.active">
              <div class="coupon-ticket-main">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <span class="coupon-ticket-type">{{ coupon.type }}</span>
                    <h2 class="mt-3 font-display text-2xl font-black">{{ coupon.title }}</h2>
                  </div>
                  <button type="button" class="coupon-status" [class.active]="coupon.active" (click)="store.toggle(coupon.id)" [attr.aria-label]="coupon.active ? 'Desactivar cupón' : 'Activar cupón'">
                    {{ coupon.active ? 'Activo' : 'Inactivo' }}
                  </button>
                </div>
                <p class="mt-3 text-sm font-semibold opacity-80">{{ coupon.benefit }}</p>
                <div class="coupon-ticket-code-wrap mt-6">
                  <span class="text-xs font-bold uppercase tracking-widest opacity-70">Código cupón</span>
                  <strong class="coupon-ticket-code">{{ coupon.code }}</strong>
                </div>
                <p class="mt-4 text-xs font-bold uppercase tracking-wider opacity-70">{{ coupon.validity || 'Sin fecha de vencimiento' }}</p>
              </div>
              <div class="coupon-ticket-actions">
                <button type="button" class="icon-btn !h-9 !w-9" (click)="openEdit(coupon)" aria-label="Editar cupón">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
                </button>
                <button type="button" class="icon-btn !h-9 !w-9 !text-danger" (click)="pendingDelete.set(coupon)" aria-label="Eliminar cupón">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>

    @if (editorOpen()) {
      <app-modal [heading]="editing() ? 'Editar cupón' : 'Crear cupón'" size="md" (closed)="closeEditor()">
        <form id="coupon-form" class="space-y-5" (submit)="save($event)">
          <div class="grid gap-5 sm:grid-cols-2">
            <label class="coupon-field sm:col-span-2"><span>Código del cupón</span><input class="input" maxlength="24" [value]="code()" (input)="code.set(value($event).toUpperCase())" placeholder="BIENVENIDA20" autocomplete="off"></label>
            <label class="coupon-field"><span>Tipo de cupón</span><select class="input" [value]="type()" (change)="setType($event)">@for (option of types; track option.value) {<option [value]="option.value">{{ option.label }}</option>}</select></label>
            <label class="coupon-field"><span>Estado inicial</span><select class="input" [value]="active()" (change)="active.set(value($event) === 'true')"><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
            <label class="coupon-field sm:col-span-2"><span>Título</span><input class="input" maxlength="80" [value]="title()" (input)="title.set(value($event))" placeholder="20% de descuento"></label>
            <label class="coupon-field sm:col-span-2"><span>Beneficio o condición</span><textarea class="input resize-none" rows="2" maxlength="180" [value]="benefit()" (input)="benefit.set(value($event))" placeholder="Válido en consumos superiores a $20.000"></textarea></label>
            <label class="coupon-field sm:col-span-2"><span>Vigencia</span><input class="input" maxlength="80" [value]="validity()" (input)="validity.set(value($event))" placeholder="Hasta el 30/06/2027"></label>
          </div>
          @if (error()) { <p role="alert" class="text-sm font-bold text-danger">{{ error() }}</p> }
        </form>
        <div modal-footer class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-secondary" (click)="closeEditor()">Cancelar</button>
          <button type="submit" form="coupon-form" class="btn btn-primary">{{ editing() ? 'Guardar cambios' : 'Crear cupón' }}</button>
        </div>
      </app-modal>
    }

    @if (pendingDelete(); as coupon) {
      <app-confirm-dialog title="Eliminar cupón" [message]="'¿Eliminar el cupón «' + coupon.code + '»? Esta acción no se puede deshacer.'" busyLabel="Eliminando…" (confirmed)="remove(coupon)" (cancelled)="pendingDelete.set(null)" />
    }
  `,
})
export class CouponsPage {
  protected readonly store = inject(CouponsStore);
  protected readonly types = COUPON_TYPES;
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Coupon | null>(null);
  protected readonly pendingDelete = signal<Coupon | null>(null);
  protected readonly code = signal('');
  protected readonly type = signal<CouponType>('DESCUENTO');
  protected readonly title = signal('');
  protected readonly benefit = signal('');
  protected readonly validity = signal('');
  protected readonly active = signal(true);
  protected readonly error = signal<string | null>(null);

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected setType(event: Event): void {
    this.type.set(this.value(event) as CouponType);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.code.set('');
    this.type.set('DESCUENTO');
    this.title.set('');
    this.benefit.set('');
    this.validity.set('');
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
    this.validity.set(coupon.validity);
    this.active.set(coupon.active);
    this.error.set(null);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const code = this.code().trim().toUpperCase();
    const title = this.title().trim();
    const benefit = this.benefit().trim();
    if (!code || !title || !benefit) {
      this.error.set('Completa el código, el título y el beneficio del cupón.');
      return;
    }
    const duplicate = this.store.coupons().some(coupon => coupon.code === code && coupon.id !== this.editing()?.id);
    if (duplicate) {
      this.error.set('Ese código ya está siendo utilizado.');
      return;
    }
    const payload = { code, type: this.type(), title, benefit, validity: this.validity().trim(), active: this.active() };
    if (this.editing()) {
      this.store.update(this.editing()!.id, payload);
    } else if (!this.store.create(payload)) {
      this.error.set('Alcanzaste el máximo de 15 cupones.');
      return;
    }
    this.closeEditor();
  }

  protected remove(coupon: Coupon): void {
    this.store.remove(coupon.id);
    this.pendingDelete.set(null);
  }
}
