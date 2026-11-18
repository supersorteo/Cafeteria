# Plan: monetización con códigos de activación (registro, vencimiento y renovación)

Estado: implementado y verificado (backend 185 tests, frontend 30 archivos / 362 tests, build y prueba en Chrome real del ciclo completo: generar lote, registrar con código, vencer, solo lectura, renovar). Falta limpiar la base de producción y desplegar; nada subido a GitHub.

## 1. Objetivo
Para registrar un negocio hay que tener un **código de activación**, que se compra. Tú los generas **por lotes** desde el panel de superadmin con cuatro duraciones: **1 mes, 3 meses, 6 meses y 1 año**. Cuando el plan vence, el negocio queda en **modo solo lectura**: puede entrar, pero no puede cambiar nada ni recibir reservas hasta que **canjee un código nuevo**. Es la misma idea de las apps Metro (`AccessCode`: tipo, registro, vencimiento, deshabilitar) aplicada a Deliora.

## 2. Decisiones tomadas
| Tema | Decisión |
|---|---|
| Inicio del plazo | Al **canjear** el código al registrarse (un código guardado no se gasta). |
| Plan vencido | **Solo lectura**: el dueño puede iniciar sesión y ver su panel, pero no puede guardar cambios (carta, fotos, ajustes, publicar). El sitio público sigue visible pero **no admite reservas**. No se borra nada. |
| Renovación | Canjeando otro código desde su panel. **Los datos pasan al código nuevo y el anterior se elimina** (sin datos fantasma). |
| Demo `/la-terraza` | **No vence nunca** (sin fecha de vencimiento). |
| Negocios actuales | Son de prueba: **se limpia la base y se empieza de cero** (local y producción) justo antes de activar el registro con código. |
| Compra | Manual: tú entregas el código al cliente. Pagos en línea fuera de alcance. |

### Supuestos (los cambias si no te convencen)
- **Formato:** `DLR-XXXX-XXXX`, con un alfabeto sin caracteres confusables (sin 0, O, 1, I): 8 caracteres de 32 símbolos, ≈ 40 bits, generados con `SecureRandom`.
- **Se guardan completos** (no cifrados) para que puedas volver a verlos y reenviarlos.
- **Un código sirve una sola vez.**
- **Renovar antes de tiempo suma:** `nuevoVencimiento = max(ahora, vencimientoActual) + duración`. Nadie pierde tiempo ya pagado.
- El vencimiento se evalúa **al momento** comparando fechas; no hace falta una tarea programada.

## 3. Modelo de datos (backend `D:\DANILO\Cafeterias\cafeteria\cafeteria`)
Migración `V6__activation_codes.sql` (forward-only):
- `code_batches(id, label, duration_months CHECK IN (1,3,6,12), quantity, created_at, created_by, note)`.
- `activation_codes(id, code UNIQUE, batch_id → code_batches, duration_months, status CHECK IN ('AVAILABLE','REDEEMED','DISABLED'), created_at, redeemed_at, redeemed_by_email, tenant_id → tenants NULL)`. Índices por `status` y `batch_id`.
- `tenants.plan_expires_at TIMESTAMPTZ NULL` (NULL = sin vencimiento) y `tenants.activation_code_id UUID NULL` → código vigente del negocio.
- Al **eliminar un negocio** (superadmin) se borran también su código canjeado y el vínculo; al **renovar** se borra el código anterior. Todo queda en `audit_log` (código, lote, negocio, acción), que es el único rastro, así no quedan filas huérfanas.

## 4. Backend
1. **Generación** (`superadmin/CodeService`): `POST /api/v1/superadmin/codes/batches {label, durationMonths, quantity (1–500), note}` crea el lote y sus códigos únicos (reintenta si hay colisión), en una transacción. Responde con los códigos para copiar o descargar.
2. **Gestión** (`ROLE_SUPERADMIN`):
   - `GET /superadmin/codes?status=&durationMonths=&batchId=&query=&page=&size=` con el negocio que lo usó, si lo hay.
   - `GET /superadmin/codes/batches`, `GET /superadmin/codes/stats` (disponibles, canjeados, deshabilitados, por vencer en 7 días).
   - `POST /superadmin/codes/{id}/disable` y `/enable` (solo si no está canjeado), `DELETE /superadmin/codes/{id}` (solo disponibles o deshabilitados).
   - `POST /superadmin/tenants/{id}/extend {months}` para ajustes manuales (opcional).
   - Todo auditado.
3. **Registro con código** (`RegistrationService`): `RegisterRequest` gana `activationCode`. Dentro de la misma transacción que crea usuario y negocio, se canjea con una sola sentencia atómica `UPDATE activation_codes SET status='REDEEMED', … WHERE code=? AND status='AVAILABLE'`; si afecta 0 filas → `400 invalid_code` genérico (no distingue «no existe», «usado» o «deshabilitado»). El negocio nace con `plan_expires_at = ahora + duración`. Si algo falla, todo se revierte y el código sigue disponible. Se mantiene el límite de intentos por IP del registro (5 por hora). `REGISTRATION_ENABLED` deja de ser el interruptor: el código pasa a ser lo que abre el registro.
4. **Renovación** (`POST /api/v1/admin/plan/redeem {code}`, solo OWNER, único endpoint de escritura permitido con el plan vencido): en una transacción, canjea el código nuevo, calcula el nuevo vencimiento, enlaza el negocio con el código nuevo y **elimina el anterior**. Error genérico `invalid_code`; límite de intentos por IP.
5. **Modo solo lectura al vencer** (un único punto): un interceptor sobre `/api/v1/admin/**` que, para `POST/PUT/PATCH/DELETE`, comprueba el plan y responde `403 plan_expired` (excepto `/admin/plan/redeem`). Las lecturas (`GET`) siguen funcionando. Un método `Tenant.planStatus()` (`ACTIVE` / `EXPIRED`) y un helper en `TenantContext` evitan repetir la comprobación. La suspensión manual del superadmin sigue siendo más estricta (bloquea el acceso).
6. **Qué expone la API:**
   - `GET /auth/me` añade `plan: {expiresAt, status}` para que el panel muestre el estado.
   - El sitio público (`PublicSiteService`) añade `reservationsEnabled` (false si el plan venció); la demo siempre true.
   - El panel de superadmin muestra vencimiento y estado en la lista de negocios.
7. **La demo** (`DemoSiteBuilder`/`DemoSiteSeeder`) se crea siempre con `plan_expires_at = NULL`.
8. **Tests** (`./mvnw test`): generación de lotes (cantidades, duraciones, unicidad, formato); canje atómico (dos registros simultáneos con el mismo código → solo uno entra); registro sin código, con código inválido, usado o deshabilitado → `invalid_code` y no crea nada; vencimiento correcto por duración; interceptor (lectura permitida, escritura `403 plan_expired`, `redeem` permitido); renovación (suma de tiempo, código anterior eliminado, sin filas huérfanas); sitio público sin reservas al vencer; demo sin vencimiento; permisos (EDITOR no renueva; dueño ajeno no ve códigos); `audit_log`.

## 5. Frontend (`D:\DANILO\Cafeterias\BAR-LA-TERRAZA`)
1. **Registro** (`auth/register.page.ts`): primer campo «Código de activación» (se normaliza a mayúsculas, acepta con o sin guiones, con ayuda «Lo recibes al adquirir tu plan»). Mensajes claros para código inválido. Si no hay código no se puede crear el negocio.
2. **Panel del dueño** con plan vencido: banner fijo «Tu plan venció el … Renueva con un código para volver a editar», botón **Renovar** (modal con el campo del código) y **controles de edición desactivados** (guardar, publicar, subir fotos, añadir platos). El interceptor de `auth.interceptor.ts` captura `403 plan_expired` y abre el modal de renovación en vez del aviso genérico. Si el plan vence en menos de 7 días, aviso suave.
3. **Sitio público** (`public-site`): si `reservationsEnabled` es false, el botón «Reservar» y el formulario muestran «Las reservas no están disponibles por ahora» y los botones «Reservar aquí» de los espacios se ocultan. La carta y el resto siguen visibles.
4. **Panel de superadmin**: nueva pestaña **«Códigos»**:
   - **Generar lote:** duración (1 mes, 3 meses, 6 meses, 1 año), cantidad, etiqueta y nota; al terminar, los códigos aparecen para **copiar todos** o **descargar CSV**.
   - **Lista** (tabla en escritorio, tarjetas en móvil): código, duración, lote, estado, quién lo usó y cuándo; filtros por estado, duración y lote; búsqueda; paginación; acciones deshabilitar, habilitar y eliminar.
   - **Resumen:** disponibles, canjeados, deshabilitados, por vencer.
   - La pestaña **Negocios** muestra vencimiento y estado del plan (y «Extender» si se hace la parte opcional).
5. **Specs**: registro con código, banner y controles bloqueados, modal de renovación, público sin reservas, pestaña Códigos (generar, copiar, filtrar, deshabilitar), `plan_expired` en el interceptor.
6. Al implementar la interfaz se aplicará `ui-ux-pro-max` para el acabado visual.

## 6. Limpieza de la base y despliegue
1. **Antes de activar el registro con código:** vaciar la base de datos de prueba.
   - Local: reiniciar el esquema `public` (ya lo hicimos antes) y dejar `ddl-auto=validate`.
   - Producción (Railway): borrar los negocios de prueba desde el panel de superadmin (suspender y eliminar) o reiniciar el esquema. Tus credenciales de superadmin no se tocan (viven en variables de entorno) y la demo se vuelve a crear sola al arrancar.
2. Hacer una **copia de seguridad** de la base de producción antes (ver `docs/deployment.md`).
3. Desplegar **primero el backend** (V6 solo añade tablas y columnas), después el frontend. Mientras el frontend nuevo no esté desplegado, el registro con código no funcionaría desde la web; por eso conviene desplegar ambos seguidos.
4. Generar tus primeros lotes y probar con una cuenta real: generar un código de 1 mes → registrar → comprobar que vence → renovar con otro código.
5. Actualizar `docs/como-funciona.md`, `docs/api-contract.md`, `docs/deployment.md` y el `DEPLOY.md` del backend.

## 7. Orden de implementación
Backend (V6 → generación de lotes → registro con canje atómico → plan en `me`/público → interceptor de solo lectura → renovación → tests) → frontend (registro → banner y bloqueo → renovación → público sin reservas → pestaña Códigos → specs) → docs → limpieza de datos y despliegue. Sin commit ni push hasta que lo pidas.

## 8. Verificación
- **Backend:** `./mvnw test` en verde con los casos de la sección 4.8.
- **Frontend:** `npm test -- --watch=false` y `npm run build`.
- **Chrome real** (base limpia, local): generar un lote de cada duración en el superadmin; registrar un negocio con un código de 1 mes; forzar su vencimiento (ajustando la fecha en la base de prueba) y comprobar que puede entrar pero no guardar, que el sitio público no admite reservas y que aparece el banner; renovar con otro código y comprobar que todo vuelve a funcionar, que el código anterior ya no existe y que el vencimiento sumó el tiempo; intentar registrarse con un código usado, inventado y deshabilitado; revisar el panel a 360, 768 y 1280 px, claro y oscuro.

## 9. Riesgos y notas
- **Adivinar códigos:** ≈ 40 bits más el límite por IP hacen inviable la fuerza bruta; los errores son siempre genéricos.
- **Reservas:** se envían por WhatsApp desde el navegador, no pasan por el servidor. Desactivarlas en el sitio público es una medida del frontend (suficiente para el uso normal; alguien que manipule la web podría seguir escribiendo por WhatsApp, pero no hay datos ni servicio del backend involucrados).
- **Códigos guardados en claro:** si se filtrara la base de datos, los códigos disponibles serían utilizables. Se mitiga con acceso restringido y borrando los canjeados al renovar. Si prefieres, se pueden guardar cifrados, a cambio de no poder volver a mostrarlos.
- **Un solo plan por negocio:** el vencimiento es del negocio, no del usuario; el dueño y sus editores comparten el mismo estado.
- **Pérdida de código tras renovar:** al eliminar el código anterior, su historial queda solo en `audit_log`.
- **Pagos en línea y recordatorios por correo** (aviso 7 días antes) quedan fuera de este alcance, pero el modelo los admite.
