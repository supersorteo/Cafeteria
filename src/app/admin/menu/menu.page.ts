import { Component, OnInit, inject } from '@angular/core';
import { CategoryPanel } from './category-panel';
import { MenuStore } from './menu.store';
import { ProductForm } from './product-form';
import { ProductPanel } from './product-panel';

@Component({
  imports: [CategoryPanel, ProductPanel, ProductForm],
  selector: 'app-menu-page',
  providers: [MenuStore],
  template: `
    <h1 class="font-display text-3xl md:text-4xl font-black">Carta</h1>

    @switch (store.categoriesState()) {
      @case ('ready') {
        <div class="mt-6 grid gap-6 lg:grid-cols-[21rem_minmax(0,1fr)] items-start">
          <app-category-panel />
          <app-product-panel />
        </div>
      }
      @case ('error') {
        <div role="alert" class="mt-8 card p-6">
          <p class="font-bold text-danger">No pudimos cargar tu carta.</p>
          <button type="button" data-retry (click)="store.loadCategories()" class="btn btn-primary mt-4">Reintentar</button>
        </div>
      }
      @default {
        <div class="mt-8 grid gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]" role="status" aria-busy="true" aria-label="Cargando">
          <div class="skeleton h-72"></div>
          <div class="skeleton h-96"></div>
          <p class="sr-only">Cargando…</p>
        </div>
      }
    }

    @if (store.editor(); as editor) {
      <app-product-form [item]="editor.item" (closed)="store.closeEditor()" />
    }
  `,
})
export class MenuPage implements OnInit {
  protected readonly store = inject(MenuStore);

  ngOnInit(): void {
    void this.store.init();
  }
}
