import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Coupon, CouponPayload, CouponsApi } from '../../core/coupons.api';

@Injectable()
export class CouponsStore {
  private readonly api = inject(CouponsApi);
  private readonly auth = inject(AuthService);

  readonly coupons = signal<Coupon[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly busy = signal(false);

  readonly locked = computed(() => this.auth.planExpired());
  readonly counted = computed(() => this.coupons().filter(coupon => coupon.counted).length);
  readonly maxActive = computed(() => this.auth.limits()?.maxActiveCoupons ?? 15);
  readonly advanced = computed(() => this.auth.advancedCoupons());

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.coupons.set(await firstValueFrom(this.api.list()));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  create(payload: CouponPayload): Promise<string | null> {
    return this.run(async () => {
      const created = await firstValueFrom(this.api.create(payload));
      this.coupons.update(list => [...list, created]);
    });
  }

  update(id: string, payload: CouponPayload): Promise<string | null> {
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.update(id, payload));
      this.coupons.update(list => list.map(item => (item.id === id ? updated : item)));
    });
  }

  toggle(coupon: Coupon): Promise<string | null> {
    return this.update(coupon.id, this.payloadOf(coupon, { active: !coupon.active }));
  }

  redeem(coupon: Coupon): Promise<string | null> {
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.redeem(coupon.id));
      this.coupons.update(list => list.map(item => (item.id === coupon.id ? updated : item)));
    });
  }

  remove(id: string): Promise<string | null> {
    return this.run(async () => {
      await firstValueFrom(this.api.remove(id));
      this.coupons.update(list => list.filter(item => item.id !== id));
    });
  }

  payloadOf(coupon: Coupon, changes: Partial<CouponPayload> = {}): CouponPayload {
    return {
      code: coupon.code,
      type: coupon.type,
      title: coupon.title,
      benefit: coupon.benefit,
      validityText: coupon.validityText,
      startsOn: coupon.startsOn,
      endsOn: coupon.endsOn,
      weekdays: this.advanced() ? coupon.weekdays : null,
      timeFrom: this.advanced() ? coupon.timeFrom : null,
      timeTo: this.advanced() ? coupon.timeTo : null,
      maxRedemptions: this.advanced() ? coupon.maxRedemptions : null,
      featured: this.advanced() ? coupon.featured : false,
      active: coupon.active,
      version: coupon.version,
      ...changes,
    };
  }

  private async run(action: () => Promise<void>): Promise<string | null> {
    this.busy.set(true);
    try {
      await action();
      return null;
    } catch (error) {
      const problem = toProblem(error);
      switch (problem.code) {
        case 'duplicate_coupon_code':
          return 'Ese código ya está siendo utilizado.';
        case 'plan_limit_reached':
          return `Tu plan permite hasta ${this.maxActive()} cupones activos a la vez. Desactiva uno o mejora tu plan.`;
        case 'plan_feature_unavailable':
          return 'Los horarios, el límite de usos y el cupón destacado son del plan Profesional.';
        case 'limit_reached':
          return 'Alcanzaste el máximo de 100 cupones guardados. Elimina los que ya no uses.';
        case 'coupon_exhausted':
          return 'Este cupón ya alcanzó su límite de usos.';
        case 'version_conflict':
          void this.load();
          return 'Otra persona cambió este cupón. Recargamos la lista, inténtalo de nuevo.';
        case 'plan_expired':
          return 'Tu plan venció. Renuévalo para hacer cambios.';
        default:
          return problem.fieldErrors[0]?.message ?? (isConnectionProblem(problem) ? 'Problema de conexión. Inténtalo de nuevo.' : 'No se pudo completar la acción.');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
