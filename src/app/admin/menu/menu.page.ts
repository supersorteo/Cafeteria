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
    <h1 class="font-display text-3xl md:text-4xl font-black" style="color:var(--plum)">Carta</h1>

    @switch (store.categoriesState()) {
      @case ('ready') {
        <div class="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr] items-start">
          <app-category-panel />
          <app-product-panel />
        </div>
      }
      @case ('error') {
        <div role="alert" class="mt-8 bg-white rounded-3xl p-6 shadow-lg">
          <p class="font-bold" style="color:#E63946">No pudimos cargar tu carta.</p>
          <button type="button" data-retry (click)="store.loadCategories()"
                  class="mt-4 bg-coral text-white font-bold px-6 py-2.5 rounded-full uppercase tracking-widest text-xs hover:brightness-110 transition-all">
            Reintentar
          </button>
        </div>
      }
      @default {
        <p class="mt-8 font-medium" style="color:#5b4150" role="status" aria-busy="true">Cargando…</p>
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
