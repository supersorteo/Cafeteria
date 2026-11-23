import { Injectable, signal } from '@angular/core';
import { Ingredient } from '../../core/catalog.models';

@Injectable({ providedIn: 'root' })
export class IngredientsStore {
  readonly ingredients = signal<Ingredient[]>([]);
  private readonly itemIngredientIds = signal<Record<string, string[]>>({});

  create(name: string): Ingredient {
    const ingredient = { id: `ingredient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim() };
    this.ingredients.update(list => [...list, ingredient]);
    return ingredient;
  }

  update(id: string, name: string): void {
    this.ingredients.update(list => list.map(ingredient => ingredient.id === id ? { ...ingredient, name: name.trim() } : ingredient));
  }

  remove(id: string): void {
    this.ingredients.update(list => list.filter(ingredient => ingredient.id !== id));
    this.itemIngredientIds.update(items => {
      const next = { ...items };
      for (const [itemId, ids] of Object.entries(next)) {
        next[itemId] = ids.filter(ingredientId => ingredientId !== id);
      }
      return next;
    });
  }

  setForItem(itemId: string, ingredientIds: string[]): void {
    this.itemIngredientIds.update(items => ({ ...items, [itemId]: [...ingredientIds] }));
  }

  idsForItem(itemId: string): string[] {
    return this.itemIngredientIds()[itemId] ?? [];
  }

  namesForItem(itemId: string): string[] {
    const byId = new Map(this.ingredients().map(ingredient => [ingredient.id, ingredient.name]));
    return this.idsForItem(itemId).map(id => byId.get(id)).filter((name): name is string => !!name);
  }
}
