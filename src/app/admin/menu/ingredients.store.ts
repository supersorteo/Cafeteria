import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../../core/api-error';
import { Ingredient } from '../../core/catalog.models';
import { IngredientsApi } from '../../core/ingredients.api';

@Injectable()
export class IngredientsStore {
  private readonly api = inject(IngredientsApi);

  readonly ingredients = signal<Ingredient[]>([]);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly busy = signal(false);

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.ingredients.set(await firstValueFrom(this.api.list()));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  async create(name: string): Promise<string | null> {
    return this.run(async () => {
      const created = await firstValueFrom(this.api.create(name));
      this.ingredients.update(list => this.sorted([...list, created]));
    });
  }

  async update(id: string, name: string): Promise<string | null> {
    return this.run(async () => {
      const updated = await firstValueFrom(this.api.update(id, name));
      this.ingredients.update(list => this.sorted(list.map(item => (item.id === id ? updated : item))));
    });
  }

  async remove(id: string): Promise<string | null> {
    return this.run(async () => {
      await firstValueFrom(this.api.remove(id));
      this.ingredients.update(list => list.filter(item => item.id !== id));
    });
  }

  private async run(action: () => Promise<void>): Promise<string | null> {
    this.busy.set(true);
    try {
      await action();
      return null;
    } catch (error) {
      const problem = toProblem(error);
      if (problem.code === 'duplicate_ingredient') {
        return 'Ese ingrediente ya existe.';
      }
      if (problem.code === 'limit_reached') {
        return 'Alcanzaste el máximo de 100 ingredientes.';
      }
      if (problem.code === 'plan_expired') {
        return 'Tu plan venció. Renuévalo para hacer cambios.';
      }
      return isConnectionProblem(problem) ? 'Problema de conexión. Inténtalo de nuevo.' : 'No se pudo completar la acción.';
    } finally {
      this.busy.set(false);
    }
  }

  private sorted(list: Ingredient[]): Ingredient[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }
}
