# Plan: conectar al backend los cambios del colaborador (marca, QR y planes)

Plan definitivo: se copia a `BAR-LA-TERRAZA/docs/plan-conexion-marca-qr.md` al aprobarlo.

## Contexto
El colaborador (solo tiene el frontend) dejó en `master` (`9239968`) tres cosas hechas únicamente en el navegador: personalización de marca (7 colores + 8 fuentes), generador QR en `/admin/qr` y planes en la portada. Nada de eso llega al backend. Hallazgos verificados:

- **La marca no se guarda:** `toPayload` en `src/app/admin/site/site-form.ts` omite los 8 campos nuevos. El `PUT /api/v1/admin/site` no los lleva y al recargar vuelven los valores por defecto. El backend tampoco tiene columnas (`Tenant.java`) ni los devuelve en el sitio público (`PublicSiteService.java:116`, `Theme(primaryColor, accentColor)`).
- **Pie de página ilegible:** el texto del footer usa `var(--site-paragraph)` (`#5B4150`) sobre `var(--site-footer)` (`#2A1420`). La cinta de frases fija `text-white`. Ya existe `readableOn()` en `shared/site-format.ts:65` para calcular un color legible.
- **Test roto:** `admin.spec.ts:73` no incluye «Generar QR». Además `preview-site.spec.ts` pasó de `toEqual` a `toMatchObject` sin cubrir los campos nuevos.
- **QR:** el diseño vive solo en señales (se pierde al recargar). Ninguna ruta ni menú limita por plan, y el backend no sabe qué duración tiene cada negocio (solo `plan_expires_at`).
- **Portada:** el modal «Personalizar mi QR» usa `api.qrserver.com`, que la CSP de `vercel.json` bloquea en producción y que envía URLs de clientes a un tercero.

Decisiones del usuario: (1) QR personalizado **desde 3 meses** de plan, validado en el backend; (2) el diseño del QR **se guarda en el backend**; (3) la portada mantiene el modal pero como **demo local** con `qr-code-styling`.

## Backend (`D:\DANILO\Cafeterias\cafeteria\cafeteria`)
Una sola migración nueva, **`V7__site_branding_and_qr.sql`**, solo aditiva (la última es V6). Se copia el patrón de V2: `ALTER TABLE tenants ADD COLUMN … , ADD CONSTRAINT …`.

1. **Columnas en `tenants`** (todas NULL = usa el valor por defecto del frontend):
   - Marca: `business_title_color`, `background_color`, `footer_color`, `heading_color`, `paragraph_color`, `whatsapp_color`, `marquee_color` (`VARCHAR(7)`, CHECK `~ '^#[0-9a-fA-F]{6}$'` como en V1) y `font_family` (CHECK en la lista cerrada: fraunces, inter, georgia, garamond, trebuchet, arial, verdana, courier).
   - QR: `qr_dot_type`, `qr_corner_type`, `qr_dot_color`, `qr_background_mode` (`solid|transparent|gradient`), `qr_background_color`, `qr_use_logo` (boolean). Listas cerradas para los tipos, tomadas de las opciones de `qr-generator.page.ts`. El logo reutiliza el `logo_url` del negocio, no se sube otro.
   - `plan_months SMALLINT` (1, 3, 6 o 12): duración del último código canjeado. Backfill en la misma migración desde `activation_codes` (`UPDATE tenants … FROM activation_codes WHERE tenant_id = t.id`). NULL = demo/sin plan: sin restricciones.
2. **Entidad** `tenant/Tenant.java`: campos, getters y setters con `@Column(name=…)` (junto a las líneas 58-62).
3. **Marca en el admin:** `site/SiteDtos.java`
   - `SiteSettingsRequest`: los 8 campos **opcionales**, con `@Pattern` hex y `@Pattern` de la lista de fuentes (mismo estilo que `currency`, línea 36).
   - `SiteSettingsResponse` (líneas 67-72): se amplía. Único constructor posicional en `SiteService.respond` (línea 234).
   - `site/SiteService.java`: `update()` (líneas 82-102) asigna con `blankToNull` y normaliza a mayúsculas; `respond()` los devuelve.
4. **Marca en el sitio público:** `publicsite/PublicSiteDtos.java` (`Theme`, línea 13) y `PublicSiteService.java:116` (único `new Theme(...)`). Sin caché que invalidar.
5. **Plan del negocio:**
   - `plan/PlanService.java`: al canjear en el registro (`redeemForRegistration`) y al renovar (`renew`) se guarda `plan_months` = duración del código nuevo.
   - `PlanSummary` en `auth/AuthController.java` (`MeResponse.plan`) y `plan/PlanController.java` (`GET /admin/plan`): añaden `months` y `qrCustomization` (true si `plan_months` es NULL o ≥ 3).
6. **Diseño del QR:** nuevo `site/QrStyleController` + servicio, `GET` y `PUT /api/v1/admin/qr` (OWNER). El `PUT` exige `qrCustomization`; si el plan no lo permite responde `403 plan_feature_unavailable`. Si el plan está vencido ya lo bloquea `PlanGuardInterceptor` (`/api/v1/admin/**`). Endpoint propio para no chocar con el bloqueo optimista (`version`) del formulario del sitio.
7. **Semillas:** `seed/DemoSiteBuilder.java` (líneas 94-95) puede fijar colores y fuente de la demo; la demo no tiene `plan_months`, así que no se limita.
8. **Tests** (JUnit con `IntegrationTestSupport`, esquema `test_it`):
   - `SiteApiTest` (modelo: `validacionesDeConfiguracion`, línea 106): hex inválido y fuente fuera de lista → 400 con `fieldErrors`; ida y vuelta de los campos nuevos; los JSON antiguos sin campos nuevos siguen válidos.
   - `PublicSiteApiTest` (línea 76): defaults en NULL y valores guardados en `theme`.
   - `ActivationCodesTest`: `plan_months` al registrar y al renovar; `/auth/me` devuelve `months` y `qrCustomization`; plan de 1 mes → `PUT /admin/qr` da 403 y 3/6/12 meses → 200; editor no puede.
   - Migración V7: backfill de `plan_months` (patrón del test de V4 con esquema propio `currentSchema`).

## Frontend (`D:\DANILO\Cafeterias\BAR-LA-TERRAZA`)
1. **Guardar la marca:** `site-form.ts` `toPayload` (~líneas 138-170) incluye los 8 campos (`.trim()` en colores; vacío → `null`). `applySettings` (líneas 106-113) ya los lee. Contrato de `SiteSettingsPayload` en `core/site-admin.models.ts:75`.
2. **Pie de página y cinta legibles:** en `public-site/public-site.ts` añadir `footerFg` y `marqueeFg` con `readableOn()` (`shared/site-format.ts:65`, ya usado en la línea 78) y enlazarlos como `--site-footer-fg` y `--site-marquee-fg` en el host (líneas 33-47). En `public-site.html` usar `rgb(var(--site-footer-fg))` y `rgb(var(--site-footer-fg) / .75)` en el footer (líneas 257-293) y `rgb(var(--site-marquee-fg))` en la cinta (líneas 87-91); dejar de usar `--site-paragraph` en el footer.
3. **Tests:** `admin.spec.ts:73` → `['Resumen','Carta','Generar QR','Configuración','Ver mi sitio']`. `preview-site.spec.ts` (líneas 28 y 85): mantener `toMatchObject` y añadir un caso con los valores del borrador y otro con los defaults. Nuevos en `public-site.spec.ts` (footer claro y oscuro) y para el payload del guardado.
4. **QR guardado y por plan:**
   - `core/auth.service.ts`: `Me.plan` gana `months` y `qrCustomization`; computed `canCustomizeQr` junto a `planExpired` y `canEditSite` (líneas 35-36). Ajustar los `makeMe` de los tests.
   - `admin/qr-generator.page.ts`: al abrir hace `GET /admin/qr` y precarga las señales (líneas 126-136); botón «Guardar diseño» con `PUT`. Sin `canCustomizeQr`, los controles de estilo quedan bloqueados con el mensaje «Disponible desde el plan de 3 meses» y se puede descargar el QR básico. Con plan vencido, solo lectura (`canEditSite`). El logo usa `tenant.logoUrl`. Quitar el fallback `https://deliora.app` (línea 145).
   - Servicio API nuevo en `core/` (patrón de `site-admin.api.ts`).
5. **Portada:** en `home/home.page.ts` quitar `qrImageUrl` y `api.qrserver.com` (líneas 243-249, 187, 190) y renderizar la demo con `qr-code-styling` en un componente compartido `shared/ui/qr-canvas` que también reutilicen `QrGeneratorPage` y `QrThumbnail`. Los precios de los planes siguen siendo «de referencia» (fuera de alcance; no coinciden con ningún dato del backend).
6. **Compatibilidad:** Jackson de Spring Boot ignora propiedades desconocidas, así que un frontend nuevo no rompe contra un backend viejo. Aun así se despliega el backend primero.

## Orden de trabajo
1. Frontend de bajo riesgo (puntos 2 y 3): arreglan el footer y el test ya. Se pueden hacer primero y por separado.
2. Backend V7 + marca + plan + QR + tests (`./mvnw test`).
3. Frontend: guardado de marca, QR guardado y por plan, portada.
4. Documentación: `docs/api-contract.md` (campos nuevos y `/admin/qr`), `docs/como-funciona.md` y backend `DEPLOY.md`.
5. Despliegue (solo cuando el usuario lo pida): backend primero (V7 es aditiva y con backfill), frontend después.

## Verificación
- Backend: `./mvnw test` (hoy 187 en verde) con los tests nuevos.
- Frontend: `npx ng test --watch=false` (hoy 375, con 1 fallo conocido que se arregla) y `npx ng build` sin errores.
- En Chrome real, con backend aislado en esquema temporal (puerto 8089, `MAIL_SENDER=log`) y `ng serve` en 4455, y capturas:
  - Guardar colores y fuente, recargar y comprobar que persisten; abrir el sitio público y ver el resultado.
  - Footer con fondo claro y con fondo oscuro, y cinta de frases con ambos: texto legible.
  - Negocio de 1 mes: QR bloqueado; de 3 meses: puede guardar el diseño y recargar.
  - Portada: la demo genera el QR sin llamadas a `api.qrserver.com` (red del navegador).
  - Revisar tamaños 1440, 1100 y 360 px y errores de consola.
- Limpiar al final: apagar servidores temporales y borrar el esquema temporal; no tocar la base local del usuario.
- Sin commit ni push hasta que el usuario lo pida.

## Riesgos
- Los precios y textos de los planes en la portada quedan sin validar con el negocio real.
- `plan_months` refleja el último código canjeado; renovar con un código más corto lo baja. Es la regla más simple y se documenta.
- Las listas cerradas de tipos de QR deben coincidir exactamente con las opciones de `qr-code-styling`; se toman del propio archivo del colaborador.
