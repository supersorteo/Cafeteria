# Plan: panel de superadmin (gestión de negocios y sus dueños)

Estado: implementado y verificado (backend 165 tests, frontend 28 archivos de test, build y prueba en Chrome real a 360/768/1280 px, claro y oscuro). Falta que definas SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD; nada subido a GitHub.

## 1. Objetivo
Un panel privado, solo para el dueño de la plataforma, desde el que ver todos los negocios registrados y sus dueños, **suspenderlos, reactivarlos y eliminarlos**. Se abre con **Ctrl+Alt+P** (modal con formulario de acceso) o entrando a `/superadmin` (necesario en móvil/tableta, sin teclado). Todo responsive.

## 2. Decisiones tomadas
| Tema | Decisión |
|---|---|
| Acceso | **Contraseña + código de 6 dígitos enviado a tu Gmail de empresa.** El panel puede borrar a todos los clientes: una contraseña filtrada sola no debe bastar. |
| Dónde viven las credenciales | Variables de entorno del servidor (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`), nunca en el código, el frontend ni la base de datos. Sin ellas, el panel no existe (los endpoints responden 404). |
| Eliminar | **Borrado definitivo, solo si el negocio está suspendido**, escribiendo su dirección (slug) para confirmar. Borra negocio, carta, fotos (también los archivos), usuarios, sesiones y correos pendientes. |
| Atajo | Ctrl+Alt+P (escritorio) + URL `/superadmin` (todos los dispositivos). El atajo es comodidad, **no seguridad**: la seguridad está en el servidor. |

## 3. Cómo funciona el acceso (backend)
Cadena de seguridad **aparte** para `/api/v1/superadmin/**` (`SecurityFilterChain` con `securityMatcher`, antes de la actual). Mismo almacén de sesiones JDBC y CSRF (`csrf.spa()`), principal propio `SuperAdminPrincipal` con autoridad `ROLE_SUPERADMIN`. No usa `tenant_users`, así que no se mezcla con los dueños de negocio.

1. `POST /api/v1/superadmin/auth/login {email, password}`: compara con las variables de entorno (la contraseña se hashea con bcrypt al arrancar; comparación en tiempo constante; siempre se ejecuta `matches` aunque el correo no coincida). Si es correcto: genera un código de 6 dígitos con `SecureRandom`, guarda **solo su hash**, caducidad (10 min) e intentos en la sesión (no en la base de datos), lo envía por `EmailSender` **directamente** (no por la bandeja `email_outbox`, para que el código nunca quede persistido) y responde `{step:"code", maskedEmail}`. Errores: siempre `401 invalid_credentials` genérico.
2. `POST /api/v1/superadmin/auth/verify {code}`: máx. 5 intentos y 10 min; al acertar, cambia el id de sesión (anti fijación), concede `ROLE_SUPERADMIN` y fija inactividad de **15 min**. Al fallar 5 veces invalida la sesión.
3. `GET /auth/me`, `POST /auth/logout`. Una sesión de dueño de negocio **no** da acceso al panel y una sesión de superadmin **no** sirve para `/api/v1/admin/**` (`TenantContext` ya exige `AppPrincipal`; se cubre con test).
4. Límites: `RateLimitFilter` existente en login y verify (5 intentos / 15 min por IP) más un retraso de 1,5 s en cada intento erróneo cuando hay más de 10 fallos recientes (nunca un bloqueo global: cualquiera podría dejar fuera al superadmin legítimo). El contador de 5 intentos del código es atómico, también ante peticiones en paralelo. Nunca se registra la contraseña ni el código.

## 4. Suspender, reactivar y eliminar
**Migración `V5__superadmin.sql`**
- `tenants.suspended_at TIMESTAMPTZ NULL` (fuente única del estado; `published` no se toca, así que al reactivar todo vuelve como estaba).
- Tabla `audit_log(id, at, action, target_label, target_id, actor, ip, detail)` **sin claves foráneas** para sobrevivir a los borrados.

**Efecto de suspender** (`suspended_at` no nulo):
- `AppUserDetailsService`: el login de cualquier miembro (dueño y editores) falla (401 genérico; el mensaje de login pasa a decir «…o la cuenta está suspendida o sin verificar»).
- `TenantContext.require()`: las sesiones abiertas dejan de funcionar al instante; además se borran de `spring_session` por correo (patrón de `AccountService.resetPassword` con `FindByIndexNameSessionRepository`).
- `PublicSiteService`: el sitio público devuelve 404. `MediaService.findPublic`: las imágenes del negocio suspendido devuelven 404.
- Reactivar: `suspended_at = NULL`.

**Eliminar** (`DELETE /superadmin/tenants/{id}` con `{confirmSlug}`; 409 si no está suspendido; 400 si el slug no coincide). En una sola transacción, en este orden: `site_images`, `site_spaces`, `site_stats`, `site_highlights`, `menu_items`, `categories`; `media_assets` (nuevo `MediaService.deleteAllOfTenant` que recoge las `storage_key`, borra filas y **borra los archivos al confirmar** el commit, local o Cloudinary); `tenant_users`, `account_tokens`, `users`; el `tenant`; `email_outbox` por destinatario; sesiones. Todo queda registrado en `audit_log`.

**API de gestión** (`ROLE_SUPERADMIN`):
- `GET /superadmin/stats`: total, activos, suspendidos, publicados, nuevos en 7 días.
- `GET /superadmin/tenants?query=&status=&page=&size=`: página con id, slug, nombre, estado, publicado, correo del dueño, verificado, nº de editores, fecha de alta.
- `POST /superadmin/tenants/{id}/suspend`, `POST /superadmin/tenants/{id}/activate`, `DELETE /superadmin/tenants/{id}`.
- `GET /superadmin/audit?limit=50`.

## 5. Frontend (`BAR-LA-TERRAZA`)
- **Atajo global** en `App` (`document:keydown`): `event.code === 'KeyP' && ctrlKey && altKey` (independiente del idioma del teclado), con `preventDefault`. Si ya hay sesión de superadmin, navega a `/superadmin`; si no, abre un `Modal` (ya existente; en móvil se comporta como hoja inferior) con el formulario.
- **Formulario de acceso** (`SuperAdminLoginForm`, usado en el modal y en `/superadmin/login`): paso 1 correo + contraseña (con `PasswordToggle`), paso 2 código de 6 dígitos (`inputmode="numeric"`, `autocomplete="one-time-code"`, autoenvío al completar, botón «Volver» y cuenta atrás de caducidad). Estilo cuidado con los tokens y componentes existentes (`AuthCard`, `Field`, `btn`, `badge`); mensajes genéricos de error y de bloqueo.
- **Rutas:** `/superadmin/login` y `/superadmin` (lazy, `superAdminGuard`) con `SuperAdminShell` (cabecera con tema claro/oscuro y «Salir»). Sin enlaces visibles en ninguna página.
- **Panel:**
  - Tarjetas de resumen (Total · Activos · Suspendidos · Publicados · Nuevos 7 días).
  - Búsqueda por nombre, dirección o correo + filtros Todos / Activos / Suspendidos; paginación.
  - **Escritorio (≥768 px):** tabla (negocio y dirección con enlace al sitio público, dueño, estado, publicado, alta, acciones). **Móvil:** tarjetas apiladas con las mismas acciones; sin desbordes a 360 px.
  - Acciones con modal de confirmación: **Suspender** (explica qué ocurrirá), **Reactivar**, **Eliminar** (solo habilitado si está suspendido; hay que escribir el slug exacto; texto de «no se puede deshacer»).
  - Pestaña «Actividad» con el registro de auditoría.
- **Servicios:** `SuperAdminApi` (HTTP), `SuperAdminAuth` (señales de estado/paso, expira sesión), `superAdminGuard`. El interceptor actual (`auth.interceptor.ts`) excluye `/api/v1/superadmin/` del flujo de «sesión expirada» de los dueños y del aviso genérico de 403.
- Al implementar la interfaz se aplicará el skill `ui-ux-pro-max` para el acabado visual.

## 6. Configuración y despliegue
- Variables nuevas: `SUPERADMIN_EMAIL` (también recibe el código; usa tu Gmail de empresa) y `SUPERADMIN_PASSWORD` (mín. 8 caracteres, validado al arrancar). Se añaden a `.env.example`, `application-production.properties`, `DEPLOY.md` y `docs/deployment.md`; en local van al `.env` (no se sube a GitHub).
- Desplegar primero el backend (V5 solo añade una columna y una tabla; no pierde datos), luego el frontend.
- Recomendación: usa una contraseña única, larga y generada por un gestor.

## 7. Orden de implementación
Backend (V5, estado suspendido en login/sesión/público/media, acceso superadmin en dos pasos, API de gestión y borrado, auditoría, tests) → frontend (servicios y guard, atajo y formulario, panel, specs) → docs. Sin commit ni push hasta que lo pidas.

## 8. Verificación
- **Backend (`./mvnw test`):** sin variables el panel responde 404; contraseña incorrecta → 401 genérico; código incorrecto/caducado/5 intentos; éxito concede acceso; sesión de dueño no entra al panel y la de superadmin no entra a `/admin`; CSRF exigido; suspender → login 401, sesión abierta 401, sitio público y fotos 404; reactivar lo restaura; eliminar exige suspendido y slug, no deja filas ni archivos huérfanos ni sesiones ni correos pendientes, y deja huella en `audit_log`; el negocio B no se ve afectado.
- **Frontend (`npm test`, `npm run build`):** el atajo abre el modal (y no con otras combinaciones), flujo de dos pasos, lista/filtros/paginación, confirmación escrita para eliminar.
- **Chrome real** (cerrar antes servidores 4300), contra una base limpia con la demo: acceso con Ctrl+Alt+P y por `/superadmin` a 360, 768 y 1280 px, claro/oscuro; suspender un negocio y comprobar que su sitio da 404 y su dueño no puede entrar; reactivar; eliminar uno de prueba.

## 9. Riesgos y notas
- Si el correo del código falla (Gmail API caída) no se puede entrar: el panel avisa con un error claro y permite reintentar; la contraseña sola nunca basta.
- El atajo y la ruta son «seguridad por oscuridad» y no cuentan como defensa: lo que protege es la contraseña, el código, los límites de intentos y la sesión corta.
- Eliminar es irreversible; por eso exige suspender antes, escribir el slug y queda auditado. Se recomienda copia de seguridad previa (ver `docs/deployment.md`).
- Un solo superadmin (el de las variables de entorno). Varios superadmins o roles intermedios quedan fuera de este alcance.
