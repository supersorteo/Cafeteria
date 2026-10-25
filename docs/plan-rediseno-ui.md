# Plan: RediseÃ±o premium de la plataforma (UI/UX, animaciones, responsive, modales)

## Context
Las 12 etapas funcionales estÃ¡n hechas (multi-tenant, auth, panel, sitio pÃºblico, despliegue). La interfaz sigue siendo bÃ¡sica: casi sin tokens de diseÃ±o (5 colores, sin escala de sombras/radios/movimiento), estilos hardcodeados con `style=""`, panel sin breakpoints reales, formularios inline (categorÃ­as, listas de textos, editor de imÃ¡genes, `site.page.ts` de 624 lÃ­neas) y dos modales distintos copiados (`confirm-dialog`, `product-form`) sin focus trap ni animaciÃ³n. Objetivo: que se vea y se sienta premium, 100 % responsive, con animaciones profesionales y formularios en modales bien hechos, sin nuevas dependencias pesadas.

Decisiones del usuario: direcciÃ³n **cÃ¡lido editorial** (guardar la alternativa Â«SaaS modernoÂ» como preset conmutable por si la quiere probar luego); **modo claro/oscuro automÃ¡tico** en plataforma y panel (la pÃ¡gina pÃºblica de cada negocio conserva su paleta personalizable y no tiene modo oscuro). El skill `ui-ux-pro-max` estÃ¡ vacÃ­o, asÃ­ que los criterios de diseÃ±o van aquÃ­.

Estado: PLAN COMPLETADO (Fases 0-8 + pasada final de QA responsive). Verificado: 190 tests, build de produccion, recorrido en 360/768/1440 px claro/oscuro sin scroll horizontal ni errores de consola. No medido: contraste automatizado ni Lighthouse. Desviaciones: registro en un solo paso (sin Stepper); sin busqueda de productos (la API pagina en servidor).

## Principios (ahorro de tokens sin perder calidad)
- **Tokens primero**: todo el diseÃ±o sale de variables CSS semÃ¡nticas â†’ cambiar preset o tema = tocar un archivo, no los templates.
- **Sin dependencias nuevas**: `<dialog>` nativo (focus trap, Esc, `inert` de fondo, restaurar foco gratis), CSS puro para movimiento (`@starting-style`, `transition-behavior: allow-discrete`, scroll-driven animations con fallback, View Transitions de Angular `withViewTransitions()`). No `@angular/animations` (obsoleto) ni CDK.
- **Componentes de UI mÃ­nimos y reutilizados**, y reescritura por plantilla en orden de impacto. Cada fase: specs + build + captura CDP; no avanzar con tests rojos.
- Respetar `prefers-reduced-motion` globalmente (ya existe en `styles.css`; se centraliza).
- Mantener ids/atributos que usan specs y scripts e2e (`#homeRegister`, `#waFloat`, etc.).

## Sistema de diseÃ±o (Fase 0)
Archivos: `tailwind.config.js`, `src/styles.css` (+ nuevo `src/styles/tokens.css`, `motion.css`, `components.css` importados desde `styles.css`).

- **Tokens semÃ¡nticos** como tripletes RGB para soportar opacidad (`rgb(var(--surface) / <alpha>)`): `bg, surface, surface-2, border, text, text-muted, primary, primary-contrast, accent, success, warning, danger, ring`.
- **Presets** por atributo `data-ui="editorial|saas"` en `<html>` y modo por `.dark` / `prefers-color-scheme` (con `data-theme="light|dark|system"` persistido en `localStorage` dentro de try/catch).
  - *Editorial (por defecto)*: marfil `#FBF6EE`, ciruela profunda `#2A1420`, coral `#E8553A`, dorado `#C99A3B`, teal `#0E8388` de apoyo; Fraunces para tÃ­tulos, Inter para UI; sombras cÃ¡lidas tintadas de ciruela; radios amplios (xlâ€“3xl).
  - *Dark editorial*: ciruela casi negra `#170B12`, superficies elevadas por luminosidad (no por sombra), coral levemente desaturado, texto marfil con contraste â‰¥ 4.5:1.
  - *SaaS (alternativa guardada)*: neutros frÃ­os, acento Ã­ndigo, Inter en todo, radios medianos; solo valores de tokens, sin cambios de templates.
- **Escalas**: sombras en capas (`shadow-xsâ€¦2xl` + `shadow-glow` del color primario), radios, espaciado base 4/8, tipografÃ­a fluida con `clamp()` (display, h1â€“h3, body, caption), `ease-out-expo`/`ease-spring` y duraciones 120/200/320/600 ms como tokens.
- **Utilidades de componente** (`@layer components`): `.btn` (+ `-primary|-secondary|-ghost|-danger`, tamaÃ±os, estado `loading` con spinner, `:active` con escala 0.98), `.input` (reemplaza `.field`: foco con anillo animado, estados error/Ã©xito), `.card`, `.badge`, `.skeleton` (shimmer), `.glass` (blur + borde translÃºcido).
- **Limpieza**: eliminar clases duplicadas (`.text-coral` etc.) y los `style="color:#5b4150"`/`#E63946`/overlay hardcodeados â†’ tokens.
- **`ThemeService`** (signal, `core/theme.service.ts`) + `ThemeToggle` (sol/luna/sistema) con transiciÃ³n suave de color (`color-scheme`, `transition` en `:root` solo al conmutar).

## UI kit compartido (Fase 1) â€” `src/app/shared/ui/`
- **`ModalShell`** sobre `<dialog>` nativo: tamaÃ±os `sm|md|lg|full`, **bottom-sheet con gesto de arrastre en mÃ³vil** y centrado con escala+fade en escritorio, backdrop blur, `Escape`, clic en backdrop (configurable, desactivado si hay cambios sin guardar), scroll lock, restauraciÃ³n de foco, `aria-labelledby`, slots `header|body|footer` con footer pegajoso, animaciÃ³n de entrada/salida (`@starting-style`).
- Migrar a `ModalShell`: `confirm-dialog` (misma API `title/message/confirmLabel/tone/busy`) y `product-form` (348 lÃ­neas). Borrar los overlays duplicados.
- **`Field`** mejorado (label flotante opcional, icono, contador, `aria-describedby`), **`PasswordInput`** (mostrar/ocultar + medidor de fortaleza en registro).
- **`Toast`** (sustituye `NoticeBanner`): apilable, barra de progreso, pausa con hover, entrada desde arriba/abajo segÃºn viewport.
- **`Skeleton`, `EmptyState` (ilustraciÃ³n SVG ligera + CTA), `Badge`, `Tabs` (indicador deslizante), `Stepper`, `Dropzone`** (arrastrar/soltar con progreso), **chips** para `string-list-editor` (aÃ±adir con Enter, quitar con âœ•, reordenar con teclado).

## Plantillas (orden de ejecuciÃ³n)

| # | Plantilla | Archivos | Cambios clave |
|---|---|---|---|
| 2 | **Portada `/`** | `home/home.page.ts` | Hero editorial con tipografÃ­a grande y mockup flotante del panel/sitio, grano sutil y degradado cÃ¡lido; secciÃ³n Â«CÃ³mo funcionaÂ» con tarjetas escalonadas; ejemplos reales de sitios; CTA final; header translÃºcido que se compacta al hacer scroll; revelado escalonado. |
| 3 | **Auth** (login, registro, olvido, reset, verificar, reenviar) | `auth/*`, `auth-card.ts` | Layout dividido en `lg` (panel de marca con testimonio/ilustraciÃ³n + formulario), una columna en mÃ³vil; `Stepper` en registro (cuenta â†’ negocio), validaciÃ³n en vivo del slug con vista previa `tudominio/slug`, mostrar/ocultar contraseÃ±a + medidor; estados de Ã©xito/error animados (check dibujado con SVG stroke); `verify-email` con estados claros. |
| 4 | **Shell del admin y dashboard** | `admin-shell.ts`, `dashboard.page.ts` | Sidebar de escritorio colapsable con iconos SVG + tooltips; **mÃ³vil: barra inferior de 3 destinos + menÃº de usuario** en lugar de la barra superior en fila; topbar con migas, estado de publicaciÃ³n y `ThemeToggle`; dashboard con tarjetas de mÃ©tricas (count-up), **checklist de puesta en marcha** (carta â†’ imÃ¡genes â†’ datos â†’ publicar) con progreso circular, accesos rÃ¡pidos y skeletons al cargar; transiciones de ruta con View Transitions. |
| 5 | **Carta** | `menu/*` | **`category-panel`: crear/editar categorÃ­a â†’ modal** (hoy inline); lista de categorÃ­as como chips/tabs horizontales en mÃ³vil y columna lateral en `lg`; productos en **grid de tarjetas** (imagen, precio, badge de estado) con filtros sticky y bÃºsqueda; `product-form` ya en `ModalShell` (con `Dropzone` y vista previa de tarjeta en vivo); borrados con `confirm-dialog`; animaciÃ³n al aÃ±adir/quitar/reordenar (FLIP simple con View Transitions); empty states. |
| 6 | **Mi sitio** | `site/site.page.ts` (624 lÃ­neas), `site-images-editor.ts` | Dividir en **secciones con `Tabs`** (General Â· Contacto y horarios Â· Apariencia Â· Contenido Â· ImÃ¡genes Â· PublicaciÃ³n) en componentes pequeÃ±os; **barra de guardado pegajosa** con estado Â«cambios sin guardarÂ»; listas de textos (marquee, zonas, comensales) como chips o modal; **editor de imÃ¡genes en modal** con `Dropzone`, progreso y recorte/orden; selector de color con vista previa en vivo de la cabecera del sitio; **modal de publicaciÃ³n** con checklist de requisitos. |
| 7 | **Sitio pÃºblico** | `public-site/*` | Mantener identidad y paleta del tenant; header con blur al hacer scroll; hero con parallax sutil (scroll-driven con fallback) y entrada escalonada; tarjetas de carta con hover/tilt suave; galerÃ­a con lightbox (`ModalShell` full); **reserva â†’ modal/bottom-sheet** abierto desde los CTA (la secciÃ³n conserva resumen + botÃ³n) y pantalla de Ã©xito animada; mejor ritmo vertical mÃ³vil; botÃ³n de WhatsApp con micro-interacciÃ³n. Conservar ids usados por specs y scripts. |
| 8 | **Residuales** | `not-found`, estados de error/carga | 404 ilustrado, pantalla de error de conexiÃ³n con reintento, skeletons uniformes. |

## CatÃ¡logo de animaciones (profesionales, sutiles, con propÃ³sito)
Entrada de pÃ¡gina (fade+translate 8 px escalonado 40â€“60 ms) Â· transiciÃ³n entre rutas (View Transitions, 200 ms) Â· modal/sheet (escala 0.96â†’1 + fade / deslizar desde abajo, curva spring) Â· toast (deslizar + barra de progreso) Â· hover de tarjetas y botones (elevaciÃ³n + desplazamiento 1â€“2 px; `:active` escala 0.98) Â· foco con anillo animado Â· shimmer de skeletons Â· count-up de mÃ©tricas Â· check SVG dibujado al Ã©xito Â· indicador deslizante de tabs Â· colapso de sidebar Â· parallax/revelado por scroll en portada y sitio pÃºblico. Todas con `transform/opacity` (GPU), â‰¤ 600 ms, y desactivadas con `prefers-reduced-motion`.

## Responsive (Fase transversal)
Mobile-first; breakpoints 360 Â· 390 Â· 768 Â· 1024 Â· 1440. Reglas: objetivos tÃ¡ctiles â‰¥ 44 px, sin scroll horizontal, `safe-area-inset` en barra inferior y sheets, tipografÃ­a fluida, modales como bottom-sheet < `md`, tablas/listas como tarjetas, imÃ¡genes con `aspect-ratio` y `loading="lazy"`.

## Accesibilidad y rendimiento
Contraste AA en ambos temas, foco visible, `aria-*` en modales/tabs/toasts, orden de tabulaciÃ³n, `lang` correcto. Presupuesto: sin librerÃ­as nuevas, CSS crÃ­tico no inline (CSP estricta ya vigente), fuentes ya autoalojadas; revisar peso del bundle inicial tras cada fase (lazy routes se mantienen).

## VerificaciÃ³n (por fase y final)
- `npm test -- --watch=false` (hoy 172 verdes) actualizando specs de componentes tocados; nuevos specs para `ModalShell` (abrir/cerrar/Esc/foco/backdrop), `ThemeService`, `Tabs`, y para los modales de categorÃ­a/imÃ¡genes/reserva.
- `npm run build` sin errores ni peticiones a CDNs; CSP de `vercel.json` intacta (sin scripts/estilos inline nuevos de origen externo).
- Capturas con los scripts CDP del scratchpad (`cdp.mjs`) en 360/768/1440 Ã— claro/oscuro Ã— editorial/saas para: portada, login, registro, dashboard, carta, mi sitio, sitio pÃºblico, modales.
- Recorrido e2e real (registro â†’ verificaciÃ³n â†’ carta â†’ publicar â†’ reserva) y `scripts/smoke.mjs`.
- ComprobaciÃ³n manual de `prefers-reduced-motion`, navegaciÃ³n solo con teclado y Lighthouse (accesibilidad â‰¥ 95) en portada y sitio pÃºblico.

## Riesgos
- `<dialog>` + animaciÃ³n de salida requiere navegadores recientes (`allow-discrete`); fallback: sin animaciÃ³n de salida, funcional igualmente.
- Reserva en modal cambia el flujo del sitio pÃºblico: validar con el usuario tras la fase 7 y mantener WhatsApp como camino directo.
- Dividir `site.page.ts` toca mucha lÃ³gica de formulario/versionado: refactor con specs existentes como red de seguridad (409 `version_conflict`, `unsavedChangesGuard`).
