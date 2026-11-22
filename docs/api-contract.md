# Contrato de API — `/api/v1`

Mismo origen (proxy). Sesión en cookie `SESSION` (HttpOnly, SameSite=Lax). Toda escritura exige CSRF: leer la cookie `XSRF-TOKEN` y repetirla en la cabecera `X-XSRF-TOKEN`. Tras login/logout el token se rota: volver a leer la cookie.

## Errores
`application/problem+json` con `status`, `title`, `detail` y `code` estable. Validación añade `fieldErrors: [{field, message}]`.

| Estado | `code` | Cuándo |
|---|---|---|
| 400 | `validation_error` | Bean Validation (ver `fieldErrors`) |
| 400 | `malformed_request` / `invalid_parameter` | JSON o UUID inválido |
| 400 | `invalid_category` | Categoría inexistente en el negocio |
| 400 | `invalid_order` | Lista de orden incompleta, repetida o con IDs ajenos |
| 400 | `version_required` | PUT sin `version` |
| 401 | `unauthenticated` / `invalid_credentials` | Sin sesión / login fallido |
| 403 | `csrf_invalid` / `forbidden` | CSRF ausente o rol insuficiente |
| 404 | `not_found` | No existe **o pertenece a otro negocio** |
| 409 | `version_conflict` | `version` desactualizada |
| 409 | `category_not_empty` | Borrar categoría con productos |
| 400 | `invalid_token` | Enlace de verificación/restablecimiento inválido, usado o caducado |
| 400 | `invalid_image` | Archivo no decodificable como JPEG/PNG/WebP, o >20 megapíxeles |
| 400 | `cannot_publish` | Faltan datos obligatorios (`fieldErrors`) |
| 403 | `registration_disabled` | Registro apagado en el backend |
| 409 | `slug_taken` | Identificador de negocio ocupado |
| 409 | `media_in_use` | Borrar una imagen referenciada |
| 409 | `limit_reached` | Máx. 30 categorías, 500 productos o 200 imágenes por negocio |
| 413 | `file_too_large` | Imagen >5 MiB |
| 429 | `too_many_attempts` | Límite de intentos (`Retry-After`) |

## Auth
| Método/ruta | Respuesta |
|---|---|
| GET `/auth/csrf` | 200 `{headerName}` y cookie `XSRF-TOKEN` |
| POST `/auth/login` | Formulario URL-encoded `username`,`password`. 200 `{authenticated:true}` + cookie `SESSION` |
| GET `/auth/me` | 200 `{email, role, tenant:{id,slug,name,published}}` |
| POST `/auth/logout` | 204 |
| POST `/auth/register` | `{email, password(10–72), businessName, slug(3–63)}` → 202 siempre igual, exista o no el email. 409 `slug_taken` |
| POST `/auth/verify-email` | `{token}` → 204 · 400 `invalid_token` |
| POST `/auth/resend-verification` | `{email}` → 202 genérico |
| POST `/auth/forgot-password` | `{email}` → 202 genérico |
| POST `/auth/reset-password` | `{token, newPassword}` → 204; cierra todas las sesiones del usuario |

Las rutas públicas también exigen CSRF y tienen límite por IP. Los enlaces de los correos apuntan a `/auth/verify-email?token=`, `/auth/reset-password?token=` y `/auth/forgot-password` del frontend; el frontend debe limpiar el token de la URL tras leerlo.

## Catálogo (`/admin`, owner o editor; el negocio sale de la sesión)
Nunca se envía `tenantId`. Todos los PUT llevan `version` (la última leída).

| Método/ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/admin/categories` | — | `[{id,name,sortOrder,version}]` ordenado |
| POST `/admin/categories` | `{name}` (1–120) | 201 categoría, al final |
| PUT `/admin/categories/{id}` | `{name, version}` | 200 categoría |
| DELETE `/admin/categories/{id}` | — | 204 · 409 si tiene productos |
| PUT `/admin/categories/order` | `{ids:[...]}` todas las categorías | 200 lista ordenada; no cambia `version` |
| PUT `/admin/categories/{id}/item-order` | `{ids:[...]}` todos los productos de la categoría | 200 productos ordenados |
| GET `/admin/menu-items?categoryId&active&page&size` | — | `{content,page,size,totalElements,totalPages}`; `size` máx. 100 (def. 50) |
| POST `/admin/menu-items` | `{categoryId,name(1–120),description(≤2000),price(≥0, 2 dec.),tag(≤40),active}` | 201 producto, al final de su categoría |
| PUT `/admin/menu-items/{id}` | igual + `version` | 200; si cambia `categoryId` pasa al final de la nueva |
| DELETE `/admin/menu-items/{id}` | — | 204 |

Producto: `{id,categoryId,name,description,price,tag,active,sortOrder,version}`. La foto (`imageId`) se añade en la Etapa 5.

La foto del producto es opcional: `imageId` (UUID de `/admin/media`) la asigna o reemplaza; `removeImage:true` la quita; sin ninguno de los dos se conserva. No se pueden enviar ambos. La respuesta añade `imageId` e `imageUrl`. La imagen anterior se borra sola si queda sin uso.

## Medios (`/admin/media`, owner o editor)
| Método/ruta | Cuerpo | Respuesta |
|---|---|---|
| POST `/admin/media` | multipart, parte `file` (JPEG/PNG/WebP, ≤5 MiB, ≤20 MP) | 201 `{id,url,mimeType,width,height,byteSize}` |
| DELETE `/admin/media/{id}` | — | 204 · 409 `media_in_use` |

El servidor decodifica y reescribe la imagen (sin metadatos): sale como `image/jpeg`, o `image/png` si tiene transparencia. La ruta física la genera el servidor. `url` es `/media/{id}` en local y la URL HTTPS de Cloudinary en producción.

GET `/media/{id}` (público, fuera de `/api/v1`): sirve el archivo con `nosniff` y caché de 1 día. Las imágenes ya publicadas siguen accesibles aunque se despublique el sitio. Las imágenes sin uso con más de 24 h se limpian solas (también archivos huérfanos).

## Sitio (`/admin`)
| Método/ruta | Rol | Cuerpo | Respuesta |
|---|---|---|---|
| GET `/admin/site` | owner/editor | — | Configuración + `images:{hero,about[],gallery[],logo}` |
| PUT `/admin/site` | **owner** | (marca: ver «Marca, QR y duración del plan») nombre, `whatsappNumber` (8–15 dígitos), phone, email, address, schedule, `currency` (UYU/USD/MXN/EUR), `locale` (es-UY/es-MX/es-ES), `timezone` (IANA), `primaryColor`/`accentColor` (#rrggbb), heroTitle, heroDescription, aboutText, `version` | 200 |
| PUT `/admin/site/images` | **owner** | `{hero?, logo?, about?[≤3], gallery?[≤6]{mediaId,alt}}` (reemplaza todo; `logo` es 1 imagen, al omitirlo se quita) | 200 |
| PUT `/admin/site/publication` | **owner** | `{published, version?}`; publicar exige `whatsappNumber` | 200 · 400 `cannot_publish` |
| GET `/admin/dashboard` | owner/editor | — | `{slug,name,published,categories,activeItems,inactiveItems,images}` |

El `slug` es inmutable. Cambiar la moneda no convierte precios.

## Sitio público
GET `/public/sites/{slug}` (sin sesión): `{slug,name,currency,locale,timezone,theme,contact,hero,about,gallery,logoUrl,categories:[{id,name,items:[{id,name,description,price,tag,imageUrl}]}]}`. Solo productos activos, ordenados; categorías vacías incluidas. Sin IDs de negocio, versiones, estado de publicación ni datos de usuarios. 404 idéntico para sitio inexistente o en borrador.

## Códigos de activación y plan (V6)

- `POST /auth/register` ahora exige `activationCode` (acepta minúsculas y con o sin guiones). Si no es válido, no existe, está usado o deshabilitado: `400 invalid_code` (siempre igual). El código se **canjea de forma atómica** en la misma transacción que crea el negocio; si algo falla, queda disponible. El negocio nace con `plan_expires_at = ahora + duración`.
- `GET /auth/me` añade `plan: {expiresAt|null, status: ACTIVE|EXPIRED}` (`null` = sin vencimiento).
- `GET /public/sites/{slug}` añade `reservationsEnabled` (false con el plan vencido).
- Con el plan **vencido**, cualquier `POST/PUT/PATCH/DELETE` de `/api/v1/admin/**` responde `403 plan_expired` (las lecturas siguen). La única escritura permitida es `POST /admin/plan/redeem`.
- `GET /admin/plan` → `{expiresAt, status}`. `POST /admin/plan/redeem {code}` (solo OWNER) → renueva: `nuevoVencimiento = max(ahora, vencimientoActual) + duración`, vincula el código nuevo y **elimina el anterior**; `400 invalid_code` si no sirve.

Superadmin (`ROLE_SUPERADMIN`):

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| POST `/superadmin/codes/batches` | `{label?, durationMonths: 1\|3\|6\|12, quantity: 1–500, note?}` | 201 `{id, label, durationMonths, codes[]}` |
| GET `/superadmin/codes?status&durationMonths&batchId&query&page&size` | | página de `{id, code, durationMonths, status, batchId, batchLabel, createdAt, redeemedAt, redeemedByEmail, tenantSlug, tenantName}` (size ≤ 500) |
| GET `/superadmin/codes/batches` · `/superadmin/codes/stats` | | lotes con disponibles/canjeados/deshabilitados · `{available, redeemed, disabled, plansExpiringSoon, plansExpired}` |
| POST `/superadmin/codes/{id}/disable` · `/enable` | | 204; 409 si no está en el estado esperado. Sobre un código **canjeado**, `disable` suspende el negocio (cierra sesiones, sitio público 404) y `enable` lo reactiva |
| DELETE `/superadmin/codes/{id}` | `{confirmSlug}` (solo si está canjeado) | 204. Sin canjear: borra el código. Canjeado: elimina el negocio en cascada; 400 `slug_mismatch` si la dirección no coincide |

`GET /superadmin/tenants` añade `planExpiresAt` y `planStatus` a cada negocio. Eliminar un negocio borra su código canjeado. Los códigos se guardan en claro para poder reenviarlos; todo queda en `audit_log`.

## Superadmin (`/superadmin`, V5)

Cadena de seguridad propia (`ROLE_SUPERADMIN`), sesión de 15 min de inactividad y CSRF igual que el resto. La sesión viaja en una cookie propia `SA_SESSION` (`Path=/api/v1/superadmin`, `HttpOnly`, `SameSite=Strict`), separada de `SESSION` de los negocios, de modo que ambas conviven sin mezclarse. Sin `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` todos los endpoints de acceso responden 404.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| POST `/superadmin/auth/login` | `{email, password}` | 200 `{step:"code", maskedEmail, expiresInSeconds}` y envía el código; 401 `invalid_credentials` genérico; 429 `too_many_attempts`; 503 `mail_unavailable` |
| POST `/superadmin/auth/verify` | `{code}` | 204 (concede acceso); 401 si el código es incorrecto, caducó o se agotaron los 5 intentos |
| GET `/superadmin/auth/me` · POST `/superadmin/auth/logout` | | `{email}` · 204 |
| GET `/superadmin/stats` | | `{total, active, suspended, published, newLast7Days}` |
| GET `/superadmin/tenants?query&status=all\|active\|suspended&page&size` | | página de `{id, slug, name, published, suspended, suspendedAt, ownerEmail, ownerVerified, editors, createdAt}` |
| POST `/superadmin/tenants/{id}/suspend` · `/activate` | | 204 (idempotente) |
| DELETE `/superadmin/tenants/{id}` | `{confirmSlug}` | 204; 409 `not_suspended`; 400 `slug_mismatch` |
| GET `/superadmin/audit?limit=50` | | `[{id, at, action, targetLabel, actor, ip, detail}]` |

Un negocio suspendido (`tenants.suspended_at`): login 401, sesiones abiertas 401, sitio público y `/media/**` 404. Una sesión de dueño no sirve en `/superadmin/**` ni la de superadmin en `/admin/**`.

## Contenido extendido del sitio (V2)
`PUT /admin/site` acepta además (todos opcionales, solo owner; las listas se **reemplazan** completas):

| Campo | Límite |
|---|---|
| `descriptor` (ej. "Bar & Cocina"), `tagline`, `aboutTitle`, `footerText`, `heroCaption` | 60 / 160 / 120 / 200 / 80 |
| `marqueeItems[]` | ≤8 textos de ≤80 |
| `partySizes[]` | ≤10 de ≤20 |
| `stats[]` `{label(≤40), value(0–999999)}` | ≤3 |
| `spaces[]` `{name(≤60, único sin distinguir mayúsculas), description(≤200), imageId?, bookable(por defecto true)}` | ≤10 |

`heroTitle` y `aboutTitle` admiten un formato mínimo: `\n` = salto de línea y `*texto*` = énfasis (cursiva de color). Se interpreta en el frontend sin HTML.

`GET /public/sites/{slug}` devuelve además `descriptor`, `tagline`, `footerText`, `hero.caption`, `about.title`, `marquee[]`, `stats[]`, `spaces[]` `{name,description,imageUrl,bookable}` y `reservation:{areas[],partySizes[]}` (`areas` = nombres de los espacios con `bookable`). Un negocio nuevo los devuelve vacíos o nulos; el frontend oculta cada sección sin contenido.

**Espacios (`V4__site_spaces.sql`).** Un espacio (Terraza, Salón, Barra…) tiene nombre, descripción, foto opcional y `bookable`. Sustituye a las tarjetas `highlights` y a `reservationAreas`: ambas se derivan de `spaces` en las respuestas (compatibilidad con clientes antiguos) y se ignoran en `PUT /admin/site`. `imageId` debe ser un medio `READY` del negocio; las fotos que dejan de usarse se limpian. La migración convierte cada tarjeta y cada zona existente en un espacio (fusionando nombres iguales) sin borrar `site_highlights` ni `tenants.reservation_areas`.

**Logo.** `GET /auth/me` incluye `tenant.logoUrl` (null si el negocio no subió uno). El frontend muestra el logo por defecto de la app (`/logos/icon-192.png`) cuando `logoUrl` es null o la imagen falla al cargar. La migración `V3__site_logo.sql` permite el slot `LOGO` en `site_images`.

## Marca, QR y duración del plan (`V7__site_branding_and_qr.sql`)

- **Marca.** `PUT /admin/site` acepta, todos opcionales (`null` o ausente = valores por defecto del frontend): `businessTitleColor`, `backgroundColor`, `footerColor`, `headingColor`, `paragraphColor`, `whatsappColor`, `marqueeColor` (`#rrggbb`, se guardan en mayúsculas) y `fontFamily` (`fraunces|inter|georgia|garamond|trebuchet|arial|verdana|courier`). `GET /admin/site` los devuelve y `GET /public/sites/{slug}` los incluye en `theme`. Valor inválido → `400` con `fieldErrors`.
- **Diseño del QR.** `GET /admin/qr` → `{dotType, cornerType, dotColor, backgroundMode, backgroundColor, useLogo, customizable}` (cualquier miembro). `PUT /admin/qr` (**owner**) con los seis campos: `dotType` `square|dots|rounded|classy|classy-rounded|extra-rounded`, `cornerType` `square|dot|extra-rounded`, `backgroundMode` `solid|transparent|gradient`, colores `#rrggbb`, `useLogo` boolean. El logo es el del negocio (`tenant.logoUrl`). Con un plan de 1 mes responde `403 plan_feature_unavailable`; con el plan vencido, `403 plan_expired`.
- **Plan.** `tenants.plan_months` guarda la duración del **último código canjeado** (registro o renovación). `GET /auth/me` y `GET /admin/plan` devuelven además `months` y `qrCustomization` (`true` si `months` es 3, 6 o 12; también si es `null`, como la demo).
