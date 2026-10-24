import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isConnectionProblem, toProblem } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { RESERVED_SLUGS, SLUG_PATTERN, slugify } from '../shared/slug';
import { AuthCard } from './auth-card';

function notReserved(control: AbstractControl<string>): ValidationErrors | null {
  return RESERVED_SLUGS.includes(control.value) ? { reserved: true } : null;
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, AuthCard],
  selector: 'app-register-page',
  template: `
    @if (done()) {
      <app-auth-card title="Revisa tu correo" subtitle="Te enviamos un enlace para confirmar tu cuenta.">
        <p class="font-medium" style="color:#5b4150">
          Abre el correo y confirma tu dirección para poder iniciar sesión. El enlace vale 24 horas.
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <div footer>
          <a routerLink="/auth/login" class="underline underline-offset-2 hover:text-coral">Ir a iniciar sesión</a>
        </div>
      </app-auth-card>
    } @else {
      <app-auth-card title="Crea tu cuenta" subtitle="Registra tu negocio y empieza a publicar tu carta.">
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
          <div>
            <label for="reg-business" class="text-xs font-bold uppercase tracking-widest text-teal">Nombre del negocio</label>
            <input id="reg-business" type="text" autocomplete="organization" formControlName="businessName"
                   class="field mt-2 w-full px-4 py-3 text-sm font-medium">
            @if (showError('businessName'); as message) {
              <p class="mt-1 text-xs font-bold" style="color:#E63946">{{ message }}</p>
            }
          </div>
          <div>
            <label for="reg-slug" class="text-xs font-bold uppercase tracking-widest text-teal">Dirección de tu sitio</label>
            <input id="reg-slug" type="text" autocomplete="off" formControlName="slug" (input)="slugEdited = true"
                   class="field mt-2 w-full px-4 py-3 text-sm font-medium">
            <p class="mt-1 text-xs font-medium" style="color:#5b4150">{{ origin }}/{{ form.controls.slug.value || 'tu-negocio' }}</p>
            @if (showError('slug'); as message) {
              <p class="mt-1 text-xs font-bold" style="color:#E63946">{{ message }}</p>
            }
          </div>
          <div>
            <label for="reg-email" class="text-xs font-bold uppercase tracking-widest text-teal">Correo</label>
            <input id="reg-email" type="email" autocomplete="username" formControlName="email"
                   class="field mt-2 w-full px-4 py-3 text-sm font-medium">
            @if (showError('email'); as message) {
              <p class="mt-1 text-xs font-bold" style="color:#E63946">{{ message }}</p>
            }
          </div>
          <div>
            <label for="reg-password" class="text-xs font-bold uppercase tracking-widest text-teal">Contraseña</label>
            <input id="reg-password" type="password" autocomplete="new-password" formControlName="password"
                   class="field mt-2 w-full px-4 py-3 text-sm font-medium">
            @if (showError('password'); as message) {
              <p class="mt-1 text-xs font-bold" style="color:#E63946">{{ message }}</p>
            } @else {
              <p class="mt-1 text-xs font-medium" style="color:#5b4150">Mínimo 10 caracteres.</p>
            }
          </div>
          @if (error(); as message) {
            <p role="alert" class="text-sm font-bold" style="color:#E63946">{{ message }}</p>
          }
          <button type="submit" [disabled]="pending()"
                  class="w-full bg-coral text-white font-bold py-4 rounded-xl uppercase tracking-widest text-sm hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {{ pending() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>
        <div footer>
          ¿Ya tienes cuenta?
          <a routerLink="/auth/login" class="underline underline-offset-2 hover:text-coral">Inicia sesión</a>
        </div>
      </app-auth-card>
    }
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly origin = typeof location === 'undefined' ? '' : location.host;
  protected readonly form = inject(NonNullableFormBuilder).group({
    businessName: ['', [Validators.required, Validators.maxLength(120)]],
    slug: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(63), Validators.pattern(SLUG_PATTERN), notReserved]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
  });
  protected readonly pending = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected slugEdited = false;

  constructor() {
    this.form.controls.businessName.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(name => {
        if (!this.slugEdited) {
          this.form.controls.slug.setValue(slugify(name));
        }
      });
  }

  protected showError(name: 'businessName' | 'slug' | 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) {
      return null;
    }
    const errors = control.errors;
    if (errors['server']) {
      return String(errors['server']);
    }
    switch (name) {
      case 'businessName':
        return 'Escribe el nombre de tu negocio.';
      case 'slug':
        if (errors['taken']) {
          return 'Esa dirección ya está en uso. Elige otra.';
        }
        if (errors['reserved']) {
          return 'Esa dirección no está disponible.';
        }
        return 'Usa de 3 a 63 letras minúsculas, números y guiones (sin guiones al inicio, al final ni dobles).';
      case 'email':
        return 'Escribe un correo válido.';
      case 'password':
        return 'La contraseña debe tener entre 10 y 72 caracteres.';
    }
  }

  protected async submit(): Promise<void> {
    if (this.pending()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.auth.ensureCsrf();
      const value = this.form.getRawValue();
      await firstValueFrom(this.http.post('/api/v1/auth/register', { ...value, email: value.email.trim(), businessName: value.businessName.trim() }));
      this.done.set(true);
    } catch (error) {
      this.handleError(toProblem(error));
    } finally {
      this.pending.set(false);
    }
  }

  private handleError(problem: ReturnType<typeof toProblem>): void {
    if (problem.code === 'slug_taken') {
      this.form.controls.slug.setErrors({ taken: true });
      this.form.controls.slug.markAsTouched();
    } else if (problem.code === 'slug_reserved') {
      this.form.controls.slug.setErrors({ reserved: true });
      this.form.controls.slug.markAsTouched();
    } else if (problem.status === 400 && problem.fieldErrors.length > 0) {
      for (const { field, message } of problem.fieldErrors) {
        const control = (this.form.controls as Record<string, AbstractControl>)[field];
        control?.setErrors({ server: message });
        control?.markAsTouched();
      }
    } else if (problem.code === 'registration_disabled') {
      this.error.set('El registro de nuevos negocios no está disponible por ahora.');
    } else if (problem.status === 429) {
      this.error.set('Demasiados intentos. Espera un rato e inténtalo de nuevo.');
    } else if (isConnectionProblem(problem)) {
      this.error.set('No pudimos conectar con el servidor. Inténtalo de nuevo.');
    } else {
      this.error.set('No se pudo crear la cuenta.');
    }
  }
}
