# Plan: «Espacios» como entidad propia (foto + nombre + descripción + acepta reservas)

Estado: implementado (backend 146 tests, frontend 25 archivos de test y build en verde); sin verificar aún en navegador contra la base real y sin subir a GitHub. Sustituye a `plan-lugares-con-foto.md` (que unía foto y zona por texto).

## 1. Problema
En la página pública (`src/app/public-site/public-site.html`, sección `#galeria` «El ambiente», l.190-217) las fotos de la galería (`site_images` GALLERY, solo `alt`) y las 3 tarjetas «Lugares y promos» (`site_highlights`) no se relacionan. Las zonas del formulario de reserva (`tenants.reservation_areas TEXT[]`, `<select id="f-zona">` en l.324-334) son texto libre sin relación con los lugares. El dueño escribe «Terraza» hasta tres veces y nada lo mantiene coherente. No hay backend de reservas: la reserva se arma en el navegador y se manda por WhatsApp (`public-site.ts:192-229`).

## 2. Idea central: un Espacio se define una sola vez
Un negocio real piensa en espacios: Terraza, Salón, Barra, Reservado VIP. Un **espacio** tiene:
- `name` (obligatorio, ≤ 60, único por negocio sin distinguir mayúsculas)
- `description` (opcional, ≤ 200)
- foto (opcional, un `media_asset` del negocio)
- `bookable` (acepta reservas; por defecto sí)

Todo lo demás se **deriva** de ahí:

| Dónde | Qué ocurre |
|---|---|
| Paso 6 «Tus espacios y fotos» | Se crean/editan los espacios (foto, nombre, descripción, «acepta reservas»). Debajo, «Más fotos del ambiente» (la galería actual, solo fotos). |
| Página pública | Cada espacio se muestra con su foto y, debajo, nombre y descripción; botón «Reservar aquí» si es reservable. |
| Formulario de reserva | El campo «Zona» lista los espacios reservables (id, no texto suelto). «Reservar aquí» abre el modal con ese espacio elegido. |
| Paso 7 «Reservas por WhatsApp» | Solo «¿Para cuántas personas?». Muestra, de solo lectura, los espacios reservables con enlace «Cambiar en el paso 6». |
| Renombrar un espacio | Se refleja en todas partes (relación por id, no por texto). |

Fuera de alcance (queda preparado, no se hace): aforo por espacio, disponibilidad, endpoint de reservas con `spaceId`.

## 3. Modelo de datos (backend `D:\DANILO\Cafeterias\cafeteria\cafeteria`)
Migración `V4__site_spaces.sql` (forward-only, tolerante como V3):
- Tabla `site_spaces`: `id UUID PK`, `tenant_id` FK, `position` (0..9), `name VARCHAR(60) NOT NULL` (CHECK no vacío), `description VARCHAR(200)`, `media_id UUID NULL`, `bookable BOOLEAN NOT NULL DEFAULT TRUE`; FK compuesta `(tenant_id, media_id)` → `media_assets` `ON DELETE RESTRICT` (igual que `site_images`); `UNIQUE (tenant_id, position)` y `UNIQUE (tenant_id, lower(name))`.
- **Migración de datos sin pérdida** (en este orden, máx. 10): (1) cada fila de `site_highlights` → espacio con `bookable=false`; (2) cada elemento de `reservation_areas` → si coincide por nombre (`lower(btrim())`) con un espacio ya creado, lo marca `bookable=true`; si no, crea un espacio nuevo `bookable=true` sin descripción ni foto.
- `site_highlights` y `tenants.reservation_areas` **no se borran** en V4 (quedan como respaldo; limpiarlos es un `V5` posterior, tras una versión estable).

## 4. Backend
1. Entidad `site/SiteSpace` + `SiteSpaceRepository` (`findByTenantIdOrderByPositionAsc`, `deleteAllByTenantId`), según el patrón de `SiteHighlight`.
2. `site/SiteDtos`: `SpaceRequest(@NotBlank @Size(max=60) name, @Size(max=200) description, UUID imageId, Boolean bookable)` y `SpaceRef(id, name, description, ImageRef image, boolean bookable)`. `SiteSettingsRequest` gana `@Size(max=10) List<@Valid SpaceRequest> spaces`; `SiteSettingsResponse` gana `spaces`. Los campos viejos `highlights` y `reservationAreas` se aceptan pero se ignoran (los clientes viejos no rompen) y la respuesta sigue incluyéndolos derivados de `spaces` durante una versión.
3. `site/SiteService.update`: dentro de la misma transacción y con el mismo control `version` → 409 (`version_conflict`) que ya existe, reemplaza los espacios (delete + `saveAllAndFlush`, posición = índice). Validaciones: nombres únicos sin distinguir mayúsculas (400 con `fieldErrors` en `spaces`), `imageId` debe existir en el negocio y estar `READY` (reusar `media.byIds`, igual que `setImages`), solo OWNER (como hoy). Tras guardar: `media.deleteIfUnreferenced` de las fotos que dejaron de usarse. `respond(...)` incluye `spaces` con la URL pública.
4. `media/MediaService`: `isReferenced` (l.117-121) y `staleUnreferenced` (l.128-131) deben contar también `site_spaces.media_id`; sin esto la limpieza borraría fotos de espacios.
5. `publicsite/PublicSiteDtos` + `PublicSiteService`: `spaces: [{name, description, imageUrl, bookable}]`; `reservation.areas` se calcula a partir de los espacios `bookable` (compatibilidad); `highlights` sigue exponiéndose derivado (los espacios no reservables sin foto… ver nota de la página pública) o se retira del DTO público junto con la nueva versión del front.
6. `seed/DevDataSeeder` (l.173 y 203-205): espacios de demo «Terraza exterior», «Salón interior», «Barra» con foto, descripción y `bookable`.
7. Tests: nuevo `SiteSpacesTest` (guardar/leer, orden, límites 60/200/10, nombre duplicado sin distinguir mayúsculas → 400, foto de otro negocio → 400, versión vieja → 409, EDITOR → 403), `PublicSiteApiTest` (espacios y `reservation.areas` derivados), `MediaCleanupTest` (no borra fotos usadas por un espacio), prueba de V4 con datos reales: highlights + areas con coincidencias/sin coincidencia/más de 10.

## 5. Frontend (`D:\DANILO\Cafeterias\BAR-LA-TERRAZA`)
1. Modelos `core/site-admin.models.ts` y `core/site.models.ts`: `spaces`; se retiran `highlights`/`reservationAreas` del formulario.
2. `admin/site/site-form.ts`: `FormArray<SpaceGroup>` (name, description, bookable, image `{id,url}`) con máx. 10 y validadores equivalentes; `buildRequest` envía `spaces` (+ `version`); `fillStrings(reservationAreas…)` y `highlights` desaparecen.
3. `admin/setup/step-forms.ts`: `StepAmbienceForm` pasa a **«Tus espacios y fotos»**: lista de espacios (miniatura + subir/cambiar foto reutilizando el componente de subida de imagen del producto del menú —verificar nombre exacto—, «Nombre del espacio», «Descripción», casilla «Acepta reservas», ↑↓ y quitar), botón «+ Añadir espacio», y debajo el editor de galería existente titulado «Más fotos del ambiente» (sin cambios de comportamiento). `StepBookingForm`: quita las zonas; deja «¿Para cuántas personas?» y muestra los espacios reservables (solo lectura) con enlace al paso 6.
4. `admin/setup/setup-steps.ts`: paso 6 → título «Tus espacios y fotos», `short/why/example/where` nuevos; `isStepDone('ambience')` = espacios > 0 o fotos > 0; `isStepDone('booking')` = grupos > 0 o algún espacio reservable.
5. `admin/setup/preview-site.ts`: mapear `spaces` del borrador (la foto subida ya tiene URL, así que se ve al instante).
6. **Página pública** (`public-site.html/.css/.ts`), sección `#galeria`: bloque de espacios con `<figure>` por espacio — imagen `.atmosphere-image` (300 px; la del medio elevada solo en escritorio, como hoy), debajo nombre en display con color coral/teal/mango por `index % 3` y descripción en `#5b4150`; sin foto, tarjeta de texto con el mismo borde de color de las tarjetas actuales; botón «Reservar aquí» si `bookable` → `openReservation(space)` que preselecciona `reservation.area`. Debajo, la galería de fotos sueltas con su lightbox sin cambios. `showAmbience` = espacios o galería. Selector «Zona» alimentado por los espacios reservables; línea `Zona: …` del WhatsApp sin cambios.
7. Specs: `site-form`, `step-forms`/`setup.page.spec.ts` (paso 6 con espacios, paso 7 sin zonas), `public-site` (figure, botón «Reservar aquí» preselecciona la zona, sin foto → tarjeta de texto), `preview-site`, fixtures `testing/site.fixture.ts` y `testing/site-admin.fixture.ts`.
8. Docs: `docs/como-funciona.md` (pasos 6 y 7), `docs/api-contract.md` (`spaces`), `docs/deployment.md` (aviso de migración V4 y copia de seguridad previa).

## 6. Despliegue en un negocio real
1. Copia de seguridad de la base (ver `docs/deployment.md`), porque V4 mueve datos.
2. **Primero backend** (Railway): Flyway aplica V4; la API sigue aceptando y devolviendo los campos viejos derivados, así que el front antiguo no se rompe.
3. **Después frontend** (Vercel) con el editor y la página pública nuevos.
4. Una versión más tarde: `V5` retira `site_highlights`, `reservation_areas` y los campos derivados.

## 7. Orden de implementación
Backend (V4 → entidad/DTOs/servicio → media → público → seed → tests) → frontend (modelos/form → pasos 6 y 7 → página pública → preview → specs) → docs. Sin commit ni push hasta que el usuario lo pida.

## 8. Verificación
- Backend: `./mvnw test` en verde; arrancar contra la base real y comprobar que Flyway aplica V4 y `ddl-auto=validate` pasa; revisar con SQL que los datos migrados coinciden (highlights + áreas fusionados).
- Frontend: `npm test -- --watch=false` y `npm run build`.
- Chrome real (cerrar antes servidores 4300): crear 3 espacios con foto, uno sin reservas; ver la página pública y la vista previa (360 px y escritorio, claro/oscuro, sin desbordes); «Reservar aquí» abre el modal con la zona elegida y el mensaje de WhatsApp lleva `Zona: …`; el espacio no reservable no aparece en «Zona»; renombrar un espacio y ver el cambio en todas partes; quitar la foto de un espacio y comprobar que el medio se limpia; paso 7 sin zonas editables.

## 9. Riesgos
- Más piezas que el parche anterior (tabla, API, editor, página pública): se mitiga con el orden por capas y tests antes del front.
- Hasta 11 elementos antiguos (3 tarjetas + 8 zonas distintas) no caben en 10: la migración conserva los 10 primeros y las tablas/columnas viejas siguen intactas hasta V5.
- La limpieza de medios es el punto más delicado: si `isReferenced`/`staleUnreferenced` no cuentan `site_spaces`, se borrarían fotos usadas (cubierto por test).
- Cambio de contrato de API: aditivo, con campos viejos derivados durante una versión.
