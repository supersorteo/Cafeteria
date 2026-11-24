# Plan: planes Emprendedor y Profesional, cupones mejorados y cobros por región

Copia en `BAR-LA-TERRAZA/docs/plan-cobros-planes.md`. Trabajo sobre `RAMA24/11` de cada repo; **sin commit ni push hasta que se pida**.

## 1. Contexto
Hoy el plan se define solo por duración (códigos de 1, 3, 6 y 12 meses) y el cobro es manual y fuera del sistema. Se quiere vender mejor con **dos planes mensuales que se diferencien por capacidad y funciones**, y con **tres vías de pago** (WhatsApp, Mercado Pago, PayPal) por región. Todo cobro termina en un **código de activación**, que ya existe (registro, renovación, deshabilitar, eliminar). Cupones e ingredientes del colaborador viven hoy solo en memoria del navegador y se conectan al backend dentro de este plan.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Planes | Dos, ambos de **1 mes**: **Emprendedor** y **Profesional**. El período queda como dato (`months = 1`); hoy no se vende otro. |
| Moneda y precio | Base en **dólares**, editable desde el panel. Sugeridos **US$ 9** y **US$ 19** por mes. Mercado Pago cobra en **pesos argentinos** (tasa automática diaria + ajuste manual + margen); PayPal en dólares. |
| Regiones de cobro | **Argentina:** Mercado Pago, PayPal, WhatsApp. **Uruguay:** PayPal, WhatsApp. El cliente puede ser de cualquier país de Latinoamérica y elige dónde paga. |
| Cuentas | Una sola cuenta de **PayPal** (de Argentina) para las dos regiones. **Mercado Pago:** cuenta del colaborador. |
| WhatsApp | Uruguay lo atiende el dueño del proyecto y Argentina el colaborador. Los números van en variables de entorno, **no en el código ni en GitHub**. |
| Superadmin | El colaborador tiene **cuenta propia de Operador**, limitada a pedidos de Argentina; sesión y código por correo propios. |
| QR | **Personalizable en ambos planes.** Se retira la regla de «3 meses o más». |

**Supuestos a confirmar** (adoptados por recomendación): marca completa solo en Profesional; los límites de cupones cuentan **solo los activos a la vez**; el soporte prioritario del Profesional por WhatsApp lleva un plazo de respuesta que se pueda cumplir.

## 3. Catálogo de planes (editable desde el panel)

| Característica | **Emprendedor** | **Profesional** |
|---|---|---|
| Precio sugerido | US$ 9 / mes | US$ 19 / mes |
| Platos en la carta | hasta **50** | hasta **100** |
| Cupones **activos a la vez** | hasta **15**, con fechas de inicio y fin | hasta **35**, con **horarios, límite de usos, canjes y cupón destacado** |
| QR personalizable | sí | sí, **y QR por mesa** (hasta 30 mesas, ajustable) |
| Marca | logo y 2 colores | **colores y fuentes completos** (7 colores y 8 fuentes) |
| Fotos de galería | hasta 6 | hasta 15 |
| Sitio, carta, reservas por WhatsApp, ingredientes | sí | sí |
| Soporte | por correo | **prioritario por WhatsApp** |
| Estadísticas (visitas, escaneos del QR, clics, canjes) | no | **etapa 2** |

**Entitlements en base de datos, no en el código.** Cada plan es una fila de `billing_plans` con sus límites (`max_menu_items`, `max_active_coupons`, `max_gallery`, `max_table_qr`) y banderas (`full_branding`, `advanced_coupons`, `table_qr`, `priority_support`, `stats`). Cambiar un límite o activar una característica es editar datos desde el panel, sin desplegar. Los negocios sin plan asignado (anteriores y la demo) se tratan como **Profesional**.

**Por qué esta estructura:** el motivo real para pagar más es el **tamaño de la carta** y las funciones **visibles** (marca completa, QR por mesa, cupones con horario), no la cantidad de cupones. Referencias de mercado revisadas: menús QR de entrada entre US$ 5 y 10, planes intermedios entre US$ 15 y 20, suites completas entre US$ 35 y 45; existen opciones gratuitas, así que la página de precios debe mostrar qué trae de más.

## 4. Comportamiento clave

- **Límite superado** (por bajar de plan o por editar límites): **nunca se borra nada**. Se bloquea crear más y el sitio público muestra solo los primeros N platos y cupones por orden; el panel avisa «ocultos por tu plan». Evita comprar un mes de Profesional, cargar 100 platos y bajar para quedárselos visibles.
- **Cupones:** el límite cuenta los **activos a la vez** (activo, dentro de fecha y con usos disponibles); vencidos y apagados no gastan cupo. Tope de archivo de 100 cupones por negocio.
- **Marca:** en Emprendedor solo se aceptan logo, color principal y secundario; el backend rechaza los campos avanzados con `403 plan_feature_unavailable` y el sitio público **ignora** la marca avanzada si el plan no la incluye (cubre las bajadas de plan).
- **QR por mesa:** el QR lleva `?mesa=N&src=qr`; el sitio público muestra «Mesa N» y la incluye en el mensaje de reserva por WhatsApp. El `src=qr` queda desde ya en todos los QR generados, para medir escaneos en la etapa 2.
- **Cupón y reserva:** el formulario de reserva por WhatsApp permite elegir un cupón vigente y añade su código al mensaje. Cada cupón tiene botón «Compartir por WhatsApp».
- **Gracia y renovación:** a los 7, 3 y 1 días del vencimiento se envía un correo con enlace de renovación; gracia configurable antes del modo de solo lectura.

## 5. Diseño de cobros
Todo cobro = **pedido → pago → un código → correo con el código → registro o renovación automática**.

```
Elegir plan → región → método → pedido (PED-XXXXXX)
   WhatsApp: abre wa.me con mensaje y referencia → el operador confirma en el panel
   Mercado Pago / PayPal: redirección a la pasarela → webhook verificado → pedido PAGADO
→ PlanService emite 1 código → correo con /auth/register?code=… → el cliente crea su negocio
```

Reutilizar (backend, bajo `cafeteria/cafeteria/src/main/java/Cafeteria`): `plan/PlanService` (`generateBatch`, `redeemForRegistration`, `renew`), `ActivationCodeFormat`, `mail/EmailOutbox.enqueue` + `EmailTemplates` (nueva constante `ACTIVATION_CODE`), `mail/GmailApiEmailSender` como patrón de `RestClient` con URL base configurable, `security/RateLimitFilter` y `SecurityConfig`, `superadmin/SuperAdminCodeService` como modelo de la sección de pedidos, `site/SiteService`, `catalog/MenuItemService`, `publicsite/PublicSiteService`. Frontend: `superadmin/superadmin-codes.ts` y `core/superadmin.api.ts`.

## 6. Backend (`cafeteria/cafeteria`)

### Migraciones (solo aditivas; la última existente es V7)
- **V8 – planes, cupones e ingredientes:** `billing_plans` (entitlements de la sección 3), `ingredients`, `menu_item_ingredients` (con `UNIQUE (tenant_id, id)` en `menu_items`), `coupons` (código único por negocio, tipo, título, beneficio, texto de vigencia, `starts_at`, `ends_at`, días y horario, `max_redemptions`, `redemptions`, `featured`, activo, orden; las columnas avanzadas existen desde ya y se habilitan por plan), `plan_code` en `code_batches`, `activation_codes` y `tenants`. Verificar si V2/V4 imponen un tope de galería a nivel de base de datos.
- **V9 – cobros:** `billing_prices` (plan × meses × USD en centavos), `billing_regions` (`AR`, `UY`: métodos activos, WhatsApp, activa), `fx_rates` (USD→ARS, origen `AUTO|MANUAL`, fecha), `billing_settings` (margen, gracia, vencimiento de pedidos), `orders` (referencia única, plan, meses, región, método, país del comprador, correo, monto USD, moneda y monto cobrado, tasa usada, estado `PENDING|PAID|CANCELLED|EXPIRED|REFUNDED`, `provider_ref`, `activation_code_id`, `tenant_id` si es renovación, quién confirmó) y `payment_events` (proveedor + id de evento **único**, idempotencia).
- **V10 – cuentas de superadmin:** `superadmin_accounts` (correo único, hash, rol `ADMIN|OPERATOR`, regiones, activa). La cuenta de las variables de entorno sigue como administrador inicial.
- **Etapa 2 (V11):** contadores diarios por negocio (`site_stats_daily`: visitas, escaneos `src=qr`, clics de WhatsApp, vistas y canjes de cupón), sin datos personales.

### Módulo de entitlements
- `PlanService.Plan` gana `planCode` y los límites y banderas leídos de `billing_plans`. Un componente único (`Entitlements`) responde «¿puede este negocio X?» y lo usan todos los servicios, de modo que la regla vive en un solo lugar.
- Aplicarlo en: `MenuItemService` (hoy tope fijo de 500), servicio nuevo de cupones, `SiteService.update` (marca avanzada), `SiteService.setImages` (galería; el DTO sube su tope de 6 a 15 y valida por plan), `PublicSiteService.get` (ocultar el exceso y la marca avanzada) y `QrStyleController`.
- `/auth/me` y `/admin/plan` devuelven plan, entitlements y **uso** (platos, cupones activos, fotos).
- **QR en ambos planes:** eliminar `QR_CUSTOMIZATION_MIN_MONTHS` y el control de plan de `site/QrStyleController` (queda solo el bloqueo por plan vencido); `qrCustomization` pasa a ser siempre verdadero; actualizar `SiteBrandingTest` y `ActivationCodesTest`.

### Cupones, ingredientes y sitio público
- `AdminIngredientController` y `AdminCouponController` bajo `/api/v1/admin` siguiendo `AdminCatalogController` (bloqueo del negocio con `lockTenant`, versión optimista, `limit_reached`/`plan_limit_reached`). `ingredientIds` dentro de `MenuItemRequest`.
- `POST /admin/coupons/{id}/redeem` suma un canje y respeta `max_redemptions` (Profesional).
- `PublicSiteService.get` añade **una consulta en lote** para ingredientes y cupones vigentes (fecha, día y horario en la zona del negocio), sin N+1; `Item` gana `ingredients` y `PublicSite` gana `coupons` (el constructor posicional de `PublicSite` se actualiza en un solo lugar).
- Añadir las tablas nuevas a `SuperAdminService.purge` **antes** de `menu_items`, y a `IntegrationTestSupport`.
- La demo `/la-terraza` se siembra con ingredientes y cupones de ejemplo en `DemoSiteBuilder`.

### Módulo `billing`
- Interfaz `PaymentProvider` con `MercadoPagoProvider`, `PayPalProvider` y `WhatsAppManual`. El servidor decide opciones, precios y montos; nunca el cliente.
- `GET /api/v1/public/billing/options?region=`, `POST /api/v1/public/billing/orders`, `GET /api/v1/public/billing/orders/{ref}`.
- **Mercado Pago (Argentina):** `POST /checkout/preferences` con `external_reference` = referencia, `notification_url` y `back_urls`. Webhook: verificar `x-signature` (HMAC-SHA256, comparación en tiempo constante, como `SuperAdminProperties`), consultar `GET /v1/payments/{id}` y comprobar estado, referencia, moneda y monto antes de marcar pagado.
- **PayPal (ambas regiones):** OAuth de cliente, orden en USD con `custom_id` = referencia, captura en el servidor al volver y webhook de respaldo con `verify-webhook-signature`.
- **Tasa ARS:** tarea programada diaria (patrón de `MediaCleanupScheduler`) sobre una URL configurable, con margen y tasa manual de respaldo; guardada en cada pedido. Si la tasa supera 72 horas se oculta Mercado Pago y se ofrece PayPal y WhatsApp.
- **Pedido pagado → código:** en una transacción, emite 1 código (`generateBatch`), lo vincula al pedido, encola el correo y audita. En una renovación aplica `renew` directamente.
- **Tareas programadas:** expirar pedidos (7 días en WhatsApp, 1 hora en pasarela), **reconciliar** cada 15 minutos los pedidos de pasarela sin aviso, y avisos de vencimiento.
- **Seguridad:** excepción CSRF solo para `POST …/billing/webhooks/mercadopago` y `/paypal` (firma obligatoria); `RateLimitFilter` por ruta exacta en `POST …/billing/orders` con `security.billing.max-attempts`; idempotencia por `payment_events`; sin datos de tarjeta (todo por redirección).
- **Cuentas de superadmin:** extender `superadmin/SuperAdminAuthService` para leer `superadmin_accounts` además de la cuenta de entorno; cada cuenta recibe su propio código de 6 dígitos. El **Operador** ve y confirma pedidos de sus regiones y ve códigos; no elimina ni suspende negocios, no genera lotes y no ve otras regiones. La auditoría guarda el correo de quien actúa.
- **Pedidos y planes en el superadmin:** `/api/v1/superadmin/orders` (listado paginado por región, confirmar con generación de código, cancelar) y administración de planes, precios, regiones y tasa (solo ADMIN).
- **Configuración:** placeholders sin dígitos en `application-production.properties` (`BILLING_MP_ACCESS_TOKEN`, `BILLING_MP_WEBHOOK_SECRET`, `BILLING_PAYPAL_CLIENT_ID`, `BILLING_PAYPAL_CLIENT_SECRET`, `BILLING_PAYPAL_WEBHOOK_ID`, `BILLING_WHATSAPP_AR`, `BILLING_WHATSAPP_UY`, `BILLING_FX_URL`); actualizar `ProductionProfileConfigTest` y `.env.example`. **Ningún valor real en archivos versionados.**

## 7. Frontend (`BAR-LA-TERRAZA`)
- **Rutas nuevas** `/precios`, `/comprar` y `/pago/resultado`, declaradas **antes de `:slug`** y reservadas en `shared/slug.ts` (`RESERVED_SLUGS`) y `SlugRules.RESERVED` del backend. La redirección a pasarela es de página completa: **no cambia la CSP**.
- **Portada y precios:** los planes se leen de `GET …/billing/options` (no más texto fijo), con tabla comparativa clara, Profesional marcado «Más elegido» y las tres diferencias visibles (doble de platos, marca completa, cupones con horario). `formatMoney` nuevo en `shared/site-format.ts`. Se quita el texto «precios de referencia».
- **Asistente de compra:** plan → región (sugerida por país, siempre editable) → método → datos → pagar o abrir WhatsApp; pantalla de resultado con estado del pedido.
- **Registro:** `auth/register.page.ts` lee `?code=`, lo prellena con `formatActivationCode` y limpia el parámetro con `replaceUrl`.
- **Superadmin:** pestaña **Pedidos** (clon de `superadmin-codes.ts`: polling, confirmaciones, filtros por región y estado) y pestaña **Planes y precios** solo ADMIN (precio, límites, banderas por plan, regiones, WhatsApp, margen y tasa). Cada cambio queda auditado y **no afecta a pedidos ya creados**. Ocultar controles por rol y validar siempre en el backend.
- **Panel del negocio:** «Mi plan» con medidor de uso («38 de 50 platos», «4 de 15 cupones»), aviso al 80 %, renovar y mejorar en un clic, y contacto de soporte según el plan.
- **QR:** se retira el bloqueo de `qr-generator.page.ts` (`locked`, aviso «desde 3 meses», `canCustomizeQr` en `auth.service.ts`); nuevo bloque **QR por mesa** (solo Profesional) con hoja imprimible; los QR llevan `?src=qr`.
- **Marca:** en «Tu marca» el Emprendedor ve los controles avanzados bloqueados con invitación a mejorar.
- **Cupones e ingredientes:** APIs y stores con `Result` como `site-settings.store.ts`; quitar ids generados en el cliente y `providedIn: 'root'`; el sitio público lee `SiteData.coupons` e `ingredients` (se elimina la dependencia del panel); `buildPreviewSite` incluye cupones. Formularios reactivos y componente compartido de CRUD en modal. Accesibilidad: etiquetas por cupón, objetivos táctiles de 44 px, colores del cupón con el tema del sitio, respetar `locked` con el plan vencido.
- **Optimización de tamaño:** `PublicSitePage` lazy (`app.routes.ts`), `qr-code-styling` con `import()` dinámico en `shared/ui/qr-canvas.ts`, `@defer` para el modal QR de la portada, y reducir `public-site.css`. Medir antes y después con `--stats-json` (hoy 509 kB frente a 500 kB y 5,14 kB frente a 5 kB).

## 8. Orden de trabajo y entregables

| Fase | Contenido | Qué se logra |
|---|---|---|
| **0** | Prerrequisitos fuera del código | Cuentas y decisiones listas |
| **A** | V8: planes con entitlements, cupones con fechas, ingredientes, QR en ambos planes, límites de platos y cupones, marca completa solo Profesional, galería 6/15, optimización | Los dos planes existen y se hacen cumplir |
| **B** | V10: cuentas de superadmin con rol Operador | El colaborador confirma pedidos de Argentina |
| **C** | V9: pedidos, WhatsApp por región, precios y compra, correo con el código, registro prellenado, pestañas Pedidos y Planes y precios | **Ya se puede vender** |
| **D** | Mercado Pago (pruebas, luego un cobro real mínimo) | Cobro automático en Argentina |
| **E** | PayPal | Cobro automático en ambas regiones |
| **F** | Prueba de 14 días (límites del Profesional) con control de abuso, avisos de vencimiento, gracia, QR por mesa y «Mi plan» completo | Más conversión y menos pérdidas |
| **G (etapa 2)** | Cupones avanzados (horario, usos, canjes, destacado) y estadísticas (V11) | Profesional con motivo de peso para pagar más |

**Fase 0 (no es código):** confirmar US$ 9 y US$ 19; el colaborador crea la aplicación de Mercado Pago y **carga él mismo las credenciales en el servidor** (nunca por chat ni por GitHub); crear la aplicación de PayPal (pruebas y producción); textos legales (términos, privacidad, reembolsos); **rotar los secretos que hoy están en `.env.example`**.

## 9. Verificación
- **Backend (`./mvnw test`):** límites de 50/100 platos y 15/35 cupones **activos**; ocultar lo que excede el límite; marca avanzada rechazada y ocultada en Emprendedor; galería por plan; QR en ambos planes; cupones por fecha, día y horario en la zona del negocio; entitlements editados desde el panel; pedidos; webhooks firmados (válido, inválido y repetido) con servidores HTTP falsos (patrón de `GmailApiEmailSenderTest`); conversión de tasa; aislamiento por región del Operador; V8–V10 con datos previos y la propiedad de producción.
- **Frontend:** `npx ng test --watch=false` y `npx ng build` sin errores nuevos.
- **Chrome real con entorno aislado** (esquema temporal, `MAIL_SENDER=log`): comprar por WhatsApp de cada región y confirmar con el Operador; pago simulado de cada pasarela con el servidor falso; el correo lleva al registro con el código escrito; los límites bloquean y ocultan en Emprendedor; QR por mesa con `?mesa=`; vista móvil del asistente; tamaños del build.
- **Sandbox real:** pagos de prueba en Mercado Pago y PayPal antes de activar producción.
- Limpiar servidores temporales y el esquema de prueba; sin commit ni push hasta que se pida.

## 10. Riesgos abiertos
- **Cuenta de Mercado Pago personal de otra persona:** acuerdo escrito sobre el reparto; cobrar para un negocio de varios con una cuenta personal puede ir contra las condiciones del servicio. Idealmente, una cuenta a nombre del negocio.
- **PayPal con cuenta argentina** cobrando a otros países: posibles retenciones y límites de retiro; verificar con un pago real pequeño.
- **Mercado Pago Argentina con compradores de otros países:** posibles rechazos; se ofrece sobre todo en la región Argentina.
- **Comisiones:** pesan más en el plan de US$ 9; verificar las tarifas reales en las cuentas antes de fijar precios.
- **Inflación en pesos:** margen y tasa automática, con la tasa guardada en cada pedido.
- **Fiscal:** facturación en dos países; consultar a un contador de cada lado.
- **Promesas:** no anunciar estadísticas ni cupones avanzados hasta que existan; el soporte prioritario exige un plazo que se pueda cumplir.
- **Editores adicionales:** el rol existe pero no hay flujo de invitación; queda fuera hasta construirlo.
