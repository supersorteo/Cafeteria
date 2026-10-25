# Plan nuevo: Angular + Spring Boot + PostgreSQL

**Proyecto:** La Terraza — sitios y panel administrativo para bares/restaurantes.  
**Fecha:** 2026-10-23.  
**Estado:** planificación; implementación no iniciada. Todos los pasos se verifican desde el estado actual del repositorio.  
**Decisión del usuario:** sustituir Supabase por un backend propio con Spring Boot y PostgreSQL. Este documento reemplaza íntegramente el plan anterior.

## 1. Objetivo y alcance

Convertir la web actual en una plataforma donde cada negocio administra su contenido, carta e imágenes. Conservar Angular y la presentación de La Terraza; añadir una API Java y persistencia PostgreSQL.

### Incluido en la primera versión

- Sitio público por negocio: `/:slug`.
- Login, logout, recuperación de contraseña y panel administrativo.
- Categorías y productos: altas, edición, baja, orden, activación y fotografías.
- Configuración de nombre, contacto, moneda, colores, textos, galería y promociones.
- Publicar/despublicar el sitio; cambios visibles al recargar, sin versiones editoriales.
- Aislamiento de datos entre negocios, roles owner/editor y pruebas de permisos.
- Registro de nuevos negocios como fase posterior al funcionamiento del panel con cuentas de desarrollo.
- Reservas por WhatsApp, manteniendo el flujo actual de solicitud y confirmación manual.

### Fuera de alcance

Suscripciones y facturación SaaS, pagos, pedidos, disponibilidad de mesas, registro de reservas, dominios propios, constructor visual libre, múltiples negocios por usuario, invitaciones y gestión de usuarios desde la UI. No añadir microservicios, Kafka ni Kubernetes para esta primera versión.

### Decisiones de partida

- Un usuario pertenece a un negocio; un negocio admite varios usuarios. El registro crea un owner. Los editores se incorporan mediante procedimiento administrativo hasta implementar invitaciones en otra fase.
- Monolito modular Spring Boot, organizado por funcionalidad, con controllers, servicios transaccionales, repositorios y DTOs.
- Base compartida con `tenant_id` en las tablas del negocio. El backend obtiene el tenant de la identidad autenticada, nunca de un parámetro confiado del navegador.
- PostgreSQL no es accesible desde Angular. El aislamiento se implementa en servicios/consultas y restricciones de integridad. RLS PostgreSQL no es requisito del MVP; incorporarla sería una mejora separada con pruebas de contexto transaccional y pool de conexiones.
- Sesiones de servidor mediante Spring Security y Spring Session JDBC. Sin JWT propio ni tokens de sesión en localStorage.
- Mismo origen en producción: `/` sirve Angular, `/api/` llega a Spring Boot y `/media/` entrega imágenes públicas a través del backend. Desarrollo usa proxy de Angular hacia `localhost:8080`.
- Archivos en disco mediante una interfaz `MediaStorage`, con volumen persistente en producción. Un adaptador S3-compatible puede añadirse después. Primera versión: una instancia backend con volumen, no réplicas con discos independientes.
- Despliegue de referencia: proxy Nginx con HTTPS, Angular compilado, backend Java, PostgreSQL y volumen de medios. No se presupone proveedor contratado. La configuración Firebase existente se conserva hasta decidir la migración del hosting; no se despliega allí una API Spring.

## 2. Herramientas y organización

| Parte | Tecnología |
|---|---|
| Frontend | Angular instalado, standalone, signals, Router, HttpClient, Forms y Vitest |
| Backend | Java 21 LTS, Spring Boot estable compatible, Maven Wrapper |
| API | Spring MVC, Bean Validation, DTOs, errores ProblemDetail |
| Seguridad | Spring Security, Spring Session JDBC, PasswordEncoder |
| Persistencia | Spring Data JPA, PostgreSQL 17, Flyway |
| Pruebas backend | JUnit, MockMvc y PostgreSQL real mediante Testcontainers |
| Pruebas navegador | Playwright |
| Desarrollo | PostgreSQL local o Docker Compose; SMTP de pruebas |
| Producción | HTTPS/proxy, backend, PostgreSQL privado y almacenamiento persistente |

Fijar versiones exactas de Spring Boot, Maven Wrapper, imagen PostgreSQL y herramientas al crear el backend. Seleccionar una versión estable disponible en Spring Initializr compatible con Java 21, sin snapshots. No actualizar Angular como parte de esta migración. Usar dependencias administradas por el BOM de Spring Boot y comprobar compatibilidad de Flyway/PostgreSQL y herramientas de pruebas.

```text
backend/
  pom.xml, mvnw, mvnw.cmd, .mvn/
  src/main/java/com/laterraza/
    TerrazaApplication.java
    config/
    security/                       # sesión, usuario autenticado, permisos
    auth/                           # registro, login, verificación y recuperación
    tenant/                         # negocio, membresía, configuración
    catalog/                        # categorías, productos y orden
    media/                          # metadatos, upload, descarga y limpieza
    publicsite/                     # consultas/DTO públicos
    shared/                         # errores, validaciones comunes
  src/main/resources/
    application.yml
    application-dev.yml
    application-test.yml
    db/migration/V1__initial_schema.sql
  src/test/java/com/laterraza/
infra/
  compose.dev.yml
  compose.prod.example.yml
  nginx.conf
src/app/
  core/                             # HTTP, auth, guards, interceptores
  models/
  public-site/                      # web actual extraída de App
  admin/                            # shell, login, dashboard, carta y configuración
  shared/
docs/
  api-contract.md
  saas-implementation-log.md
  saas-operations.md
  superpowers/plans/2026-10-23-saas-admin-panel.md
```

Mantener Angular en la raíz y añadir `backend/`: no reorganizar todo el repositorio sin necesidad. No crear rutas ni importar componentes que aún no existan.

## 3. Autenticación, permisos y aislamiento

### Sesión y seguridad HTTP

- Spring Security autentica email/contraseña; hash con `DelegatingPasswordEncoder`, nunca texto plano. Email normalizado en servidor y único sin distinción de mayúsculas.
- Cookie de sesión HttpOnly, Secure en producción, SameSite=Lax, Path=/, sin Domain amplio. Rotar identificador al autenticar y expirar tras 30 minutos de inactividad.
- Persistir sesiones con Spring Session JDBC y migraciones Flyway controladas. Invalidar al cerrar sesión y todas las sesiones del usuario al cambiar contraseña o deshabilitar cuenta.
- CSRF activo también en login/logout y subidas multipart. `GET /api/v1/auth/csrf` inicializa el token; cookie `XSRF-TOKEN` legible por Angular y cabecera `X-XSRF-TOKEN`. La cookie de sesión sí permanece HttpOnly.
- Implementar la integración SPA recomendada por la versión de Spring Security elegida, incluidos tokens diferidos/BREACH y renovación del token después de login/logout. Usar URLs relativas para el interceptor XSRF de Angular.
- Login con el filtro de autenticación de Spring Security configurado para responder JSON, aceptando formulario URL-encoded `username`/`password`; Angular puede presentar email como etiqueta. No crear un controller que olvide guardar SecurityContext o ejecutar protección contra fijación de sesión.
- API devuelve 401 para sesión ausente/expirada, 403 para operación no permitida, sin redirecciones HTML de login.
- CORS no es necesario con el proxy del mismo origen. Si se cambia el despliegue, revisar cookies, CSRF y orígenes explícitos antes; nunca combinar credenciales con wildcard de origen.
- No registrar contraseñas, cookies o tokens. Limitar intentos de login/registro/recuperación y tamaño de peticiones. Actuator público solo muestra salud mínima; detalles internos privados.

### Roles

| Operación | Anónimo | Editor del negocio | Owner del negocio |
|---|---|---|---|
| Ver sitio publicado y carta activa | Sí | Sí | Sí |
| Leer contenido propio no publicado/inactivo | No | Sí | Sí |
| Administrar categorías/productos/medios propios | No | Sí | Sí |
| Cambiar configuración/publicación | No | No | Sí |
| Cambiar roles, pertenencia o slug desde API cliente | No | No | No |
| Administrar otro negocio | No | No | No |

- `TenantContext` se obtiene del principal y membresía activa. Nunca aceptar `tenant_id` en DTOs de escritura.
- Repositorios de recursos privados usan `findByIdAndTenantId` y equivalentes para update/delete/listado. No usar un `findById` global seguido de un guard únicamente en Angular.
- Recurso ajeno solicitado por ID devuelve 404. Rol insuficiente para operación propia devuelve 403. Probar ambos casos.
- Permisos también en servicios para evitar bypass desde otro controller. Revalidar pertenencia/estado de cuenta al resolver acceso, no confiar indefinidamente en datos de sesión obsoletos.
- Proyecciones públicas separadas: jamás serializar entidades JPA, hashes, membresías, tokens ni información administrativa.

## 4. Modelo PostgreSQL e integridad

IDs UUID, fechas UTC con `timestamptz`, importes `numeric(10,2)`/Java BigDecimal. Migraciones Flyway; Hibernate `ddl-auto=validate`, no `update` en producción. Desactivar Open Session in View y delimitar transacciones en servicios.

| Tabla | Campos principales |
|---|---|
| `users` | id, email normalizado único, password_hash, enabled, email_verified_at, fechas |
| `tenants` | id, slug único, name, published=false, whatsapp_number, phone, email, address, schedule, currency, locale, timezone, primary_color, accent_color, content JSONB, version, fechas |
| `tenant_users` | id, user_id UNIQUE, tenant_id, role OWNER/EDITOR |
| `categories` | id, tenant_id, name, sort_order, version, fechas |
| `menu_items` | id, tenant_id, category_id, name, description, price, tag, image_id nullable, active, sort_order, version, fechas |
| `media_assets` | id, tenant_id, storage_key única, mime_type, byte_size, width, height, status, fechas |
| `account_tokens` | id, user_id, purpose VERIFY_EMAIL/RESET_PASSWORD, token_hash, expires_at, used_at |
| `email_outbox` | id, tipo, destinatario/payload mínimo, estado, intentos, próximo intento, fechas |
| tablas Spring Session | esquema correspondiente a la versión fijada, aplicado mediante Flyway |

### Restricciones obligatorias

- IDs primary key, FK de tenant/membresía NOT NULL, rol limitado, un usuario por negocio y un único owner por tenant mediante índice único parcial.
- `UNIQUE(tenant_id,id)` en categorías y medios; FK compuesta de producto `(tenant_id,category_id)` hacia categoría `(tenant_id,id)`. Otra FK compuesta para su imagen cuando exista.
- Borrar categoría con productos: RESTRICT y respuesta 409, no cascada silenciosa. Borrar medio referenciado: 409. Bajas completas de tenant/usuario fuera del MVP.
- Precio no negativo; nombres recortados no vacíos; límites en DB y DTOs: nombre 120, descripción de producto 2000, etiqueta 40. Definir máximos de otros textos antes de implementarlos.
- Slug 3–63 caracteres ASCII minúsculos, números y guiones interiores, sin guiones consecutivos. Reservar `admin`, `api`, `media`, `assets`, `images`, `auth`, `www`, `support`, `status`. Inmutable en MVP.
- WhatsApp internacional de 8–15 dígitos sin `+` ni espacios; colores hex de seis dígitos. Monedas iniciales UYU/USD/MXN/EUR, locales es-UY/es-MX/es-ES, zona IANA validada con Java ZoneId.
- Orden por `sort_order,id`; índices por tenant/categoría/orden. Reordenamiento transaccional con validación de lista completa, sin IDs duplicados/ajenos, serializado por tenant/categoría.
- Versionado optimista con `@Version` para evitar sobrescribir ediciones concurrentes. DTO de edición incluye versión; conflicto devuelve 409 y UI ofrece recargar.
- Usuario de ejecución DB sin permisos de DDL/superusuario; credenciales de migración separadas en producción. DB en red privada.

### Configuración del sitio

`SiteContent` tipado y versionado (`schemaVersion: 1`), guardado en JSONB. Bean Validation valida objetos anidados, tamaño y propiedades; DB exige objeto JSON y versión soportada. Solo la API escribe; no aceptar HTML ejecutable ni URLs arbitrarias de medios.

Campos: hero (título/descripción/imagen), nosotros (texto/hasta 3 fotos), galería (hasta 6 fotos y alt), hasta 3 tarjetas de espacios/promociones, hasta 8 textos de marquesina, hasta 3 estadísticas etiqueta/valor, zonas de reserva (hasta 8) y opciones de personas. Las imágenes se referencian por ID y el servicio valida tenant/existencia antes de guardar. Comprobar referencias JSON al borrar un medio en una transacción con bloqueo compartido por tenant para evitar carreras.

Los negocios nuevos empiezan con contenido vacío/neutro, nunca con textos o fotos de La Terraza. Publicar exige datos de contacto/moneda/zona válidos, no una foto. Horarios son informativos; no inferir disponibilidad desde texto libre. Cambiar moneda no convierte importes y requiere advertencia explícita en UI.

## 5. Contrato de API

Prefijo `/api/v1`; documentar DTOs, estados, ejemplos y validaciones en `docs/api-contract.md` antes de conectar cada pantalla. Listas privadas paginadas con límite máximo; respuestas públicas ordenadas y con presupuesto de tamaño definido. Errores `application/problem+json` con código estable, fieldErrors cuando corresponda y sin stack trace.

| Método/ruta | Función |
|---|---|
| GET `/auth/csrf` | Inicializar/renovar token CSRF |
| POST `/auth/login` | Filtro Spring Security; sesión y respuesta JSON |
| GET `/auth/me` | Usuario, rol, negocio; 401 si no hay sesión |
| POST `/auth/logout` | Invalidar sesión y cookie |
| POST `/auth/register` | Cuenta/negocio/membresía pendiente de verificación |
| POST `/auth/verify-email` | Consumir token de un solo uso |
| POST `/auth/resend-verification` | Respuesta genérica y límites de frecuencia |
| POST `/auth/forgot-password` | Respuesta genérica, sin revelar cuentas |
| POST `/auth/reset-password` | Consumir token, cambiar hash, invalidar sesiones |
| GET `/public/sites/{slug}` | DTO público con contenido y carta activa; 404 si no publicado |
| GET `/admin/dashboard` | Resumen del tenant autenticado |
| GET/PUT `/admin/site` | Leer/configurar negocio; escritura solo owner |
| PUT `/admin/site/publication` | Publicar/despublicar con validación |
| GET/POST `/admin/categories` | Listar/crear categorías |
| PUT/DELETE `/admin/categories/{id}` | Editar/eliminar categoría propia |
| PUT `/admin/categories/order` | Orden transaccional |
| GET/POST `/admin/menu-items` | Listar con filtros/crear producto |
| PUT/DELETE `/admin/menu-items/{id}` | Editar/eliminar producto propio |
| PUT `/admin/categories/{id}/item-order` | Reordenar productos de una categoría |
| POST `/admin/media` | Multipart; devolver metadatos e ID |
| DELETE `/admin/media/{id}` | Eliminar medio propio no referenciado |
| GET `/media/{id}` fuera de `/api/v1` | Archivo público válido, MIME seguro |

### Alta de negocio

`RegistrationService.register` es transaccional: usuario + tenant en borrador + owner + token de verificación + outbox de correo. UNIQUE en email/slug resuelve carreras; una comprobación previa de disponibilidad no sustituye restricciones. Ante fallo de DB, rollback completo.

El correo se envía después mediante outbox reintentable: caída SMTP no revierte un alta confirmada. Token aleatorio criptográfico, hash en tabla, expiración y consumo único atómico. El payload de outbox que permite enviar el enlace es sensible: acceso restringido, nunca logs y borrado/redacción tras envío. Recuperación usa la misma disciplina.

Cuenta sin verificar no inicia sesión; registro muestra revisar correo. Reintento tras respuesta perdida no duplica cuenta/tenant; error público no revela existencia de email y ofrece recuperar acceso/reenviar. Colisión de slug permite elegir otro sin dejar datos parciales. Registro deshabilitable mediante propiedad backend `registration.enabled`, no solo ocultando un botón.

## 6. Almacenamiento de imágenes

- `MediaStorage` separa disco de lógica de negocio. Ruta física generada por servidor con UUIDs bajo raíz configurada; nunca usar nombre/path enviado por el cliente ni permitir traversal.
- JPEG/PNG/WebP, máximo 5 MiB y 20 megapíxeles; validar bytes/decodificación real, no confiar en extensión o Content-Type. Elegir un decoder con soporte WebP y probarlo; rechazar formato no decodificable. Reescribir imagen sin metadata antes de publicarla.
- Almacén fuera del directorio ejecutable/estático de la app, volumen persistente con permisos mínimos. `media_assets` controla qué archivos están disponibles; nunca listar carpetas.
- GET público entrega solo assets READY, Content-Type correcto y `X-Content-Type-Options: nosniff`. IDs opacos no son autorización: las imágenes publicadas por esta ruta son públicas por diseño, incluso si se despublica el sitio. Informarlo antes de subir.
- Upload: escribir temporal, validar, mover atómicamente y registrar estado. DB y disco no forman una sola transacción; definir compensación y reconciliación de archivos/metadatos huérfanos.
- Editar sin nueva foto conserva referencia. Quitar foto es explícito. Reemplazar sube nuevo archivo, actualiza referencia y limpia el anterior solo si no está referenciado.
- Limpieza programada reintentable con periodo de gracia de 24 horas, comprobación de referencias y bloqueo por tenant. No borrar archivos que una operación concurrente esté asociando.
- Seed importa fotos actuales mediante servicio/script controlado; una vez migradas y verificadas se retira fallback legacy. No borrar fotos locales durante extracción del frontend.

## 7. Secuencia de implementación

Cada etapa incluye código, pruebas, actualización de este documento y bitácora. Un commit por entrega funcional (`feat`, `fix`, `refactor`, `test`, `build`, `chore`). No incluir cambios ajenos ni crear commits vacíos. Todas las casillas comienzan pendientes tras la reversión del usuario.

### Etapa 1 — Línea base y requisitos

**Dependencias:** ninguna. **Entrega:** estado inicial documentado y entorno identificado.

- [ ] Revisar instrucciones locales y Git; preservar `.claude/`, environments y cualquier cambio existente sin mostrar secretos.
- [ ] Ejecutar pruebas/build Angular y registrar resultado real; capturar web móvil/escritorio y flujo de reserva sin enviar mensajes.
- [ ] Verificar Java 21, Maven Wrapper previsto, PostgreSQL local/Docker y navegador de pruebas. Registrar bloqueos sin usar producción como sustituto.
- [ ] Fijar versiones y contratos de alcance en bitácora. Crear `docs/saas-implementation-log.md`.
- [ ] Registrar evidencias, actualizar casillas y commit de documentación.

### Etapa 2 — Backend ejecutable y base versionada

**Dependencias:** 1. **Entrega:** Spring Boot arranca y valida esquema PostgreSQL.

- [ ] Crear `backend/` con Maven Wrapper, Web/MVC, Validation, Security, JPA, PostgreSQL, Flyway, Spring Session JDBC y pruebas.
- [ ] Configurar perfiles dev/test/prod y ejemplo de variables sin secretos. Puerto local 8080, prefijo API y salud mínima.
- [ ] Añadir Compose de desarrollo para PostgreSQL/SMTP de pruebas y alternativa de conexión a PostgreSQL local.
- [ ] Crear migraciones de tablas, índices, constraints y sesiones; `ddl-auto=validate` y OSIV desactivado.
- [ ] Probar arranque desde DB vacía y aplicación de migraciones en PostgreSQL real. No usar H2 como sustituto de estas pruebas.
- [ ] Ejecutar `backend/mvnw.cmd -f backend/pom.xml verify` en Windows; registrar resultados y commit.

### Etapa 3 — Seguridad, tenant y datos de desarrollo

**Dependencias:** 2. **Entrega:** login/sesión/permisos comprobados antes de CRUD.

- [ ] Implementar principal, TenantContext, membresía/roles, PasswordEncoder y filtro login con respuesta JSON.
- [ ] Configurar CSRF SPA, sesión JDBC, logout, 401/403, protección de fijación y expiración.
- [ ] Implementar `/auth/me`, `/auth/csrf`, y errores comunes; limitar intentos y no filtrar secretos en logs.
- [ ] Seed dev explícito/repetible: A/B con owners, editor A, contraseñas por entorno; importación de 5 categorías/28 productos actuales sin duplicados. Nunca ejecutar automáticamente en prod.
- [ ] Tests MockMvc/PostgreSQL: login válido/inválido, cookie/sesión, logout, CSRF ausente, sesión expirada y acceso por rol.
- [ ] Tests de FK compuesta, precio inválido, email/slug duplicado y bloqueo de relaciones entre tenants. Verificar/registrar/commit.

### Etapa 4 — API de categorías y productos

**Dependencias:** 3. **Entrega:** catálogo administrable por HTTP de forma aislada.

- [ ] DTOs validados, servicios `@Transactional`, repositorios siempre acotados al tenant, paginación/filtros y Open Session in View desactivado.
- [ ] CRUD categorías/productos, foto opcional inicialmente, active y orden estable.
- [ ] Borrar categoría con productos devuelve 409. Reordenamiento atómico completo; mover producto de categoría define posición final.
- [ ] Concurrencia con @Version y conflictos 409; no permitir actualizar IDs/pertenencia desde DTO.
- [ ] Documentar API y probar A intentando leer/editar/borrar IDs de B, incluyendo reorder e IDs manipulados en payload.
- [ ] Verificar/registrar/commit. Los tests comprueban estado final de B, no solo el status HTTP.

### Etapa 5 — Medios, configuración y sitio público

**Dependencias:** 4. **Entrega:** API pública y configuración completa con imágenes.

- [ ] Implementar MediaStorage de disco, metadatos, upload/descarga/borrado, límites y reconciliación de sección 6.
- [ ] Importar fotografías demo con IDs y relaciones consistentes; comprobar reemplazos y fallos de DB/disco.
- [ ] SiteContent validado, configuración owner, lectura editor, publicación/despublicación y dashboard.
- [ ] Implementar DTO público separado: solo publicado/activo, sin datos internos; 404 para desconocido/borrador.
- [ ] Tests de tipo/tamaño/traversal, fotos compartidas, referencias ajenas, limpieza, roles y ausencia de campos privados en respuestas públicas.
- [ ] Verificar/registrar/commit.

### Etapa 6 — Preparar Angular y extraer la web actual

**Dependencias:** 5. **Entrega:** web preservada bajo routing y compilación reproducible.

- [ ] Reemplazar Tailwind CDN por compilación local compatible y alojar Inter/Fraunces localmente con licencias; fijar versiones. No cambiar diseño ni framework.
- [ ] Extraer App a PublicSite; App solo contiene RouterOutlet. Mover pruebas existentes y mantener datos estáticos temporalmente.
- [ ] `/` redirige a `/la-terraza`, preservando fragmentos; desconocidos muestran no encontrado. No importar pantallas admin futuras.
- [ ] Corregir texto corrupto, labels asociados y enlace de correo Cloudflare inválido, sin inventar datos de contacto.
- [ ] Ejecutar `npm test -- --watch=false`, `npm run build` y comparación móvil/escritorio sin solicitudes a CDNs.
- [ ] Actualizar plan/bitácora y commit.

### Etapa 7 — Angular conectado a la API pública

**Dependencias:** 6. **Entrega:** web pública A/B con datos PostgreSQL a través de Spring.

- [ ] Configurar HttpClient, proxy dev `/api` y `/media`, servicios tipados y errores; base URL relativa, sin credenciales DB en Angular.
- [ ] Cargar slug mediante ActivatedRoute.paramMap; cancelar/descartar respuesta anterior al cambiar negocio.
- [ ] Estados loading/error/no encontrado/vacío distintos. Error de red nunca muestra demo ni falso 404.
- [ ] Datos de tenant en textos/colores/contacto/galería y precios con moneda/locale. Imagen nula y categorías vacías válidas.
- [ ] Reinstalar observadores tras render asíncrono; cleanup y fallback visible sin IntersectionObserver; movimiento reducido.
- [ ] Conservar WhatsApp, validar nombre recortado y fecha según zona; no presentar solicitud como reserva confirmada.
- [ ] Retirar datos hardcodeados activos tras comparar con seed. Probar A→B con respuesta tardía A y mensaje de reserva interceptado.
- [ ] Build/tests, plan/bitácora y commit.

### Etapa 8 — Acceso y estructura del panel Angular

**Dependencias:** 7. **Entrega:** login, sesión restaurada, shell y dashboard mínimo.

- [ ] AuthService con initializing/authenticated/anonymous/error; iniciar CSRF y `/auth/me`. Error de red no equivale a logout.
- [ ] Login URL-encoded según contrato, reobtención CSRF después de login/logout; no guardar sesión en localStorage.
- [ ] Guards esperan sesión; permisos de UI reflejan backend. Interceptor 401 limpia datos/redirige; 403 muestra permiso/CSRF sin bucles ni reintentos automáticos de escrituras.
- [ ] Crear login/shell/dashboard juntos antes de registrar rutas; sidebar solo enlaza pantallas existentes.
- [ ] Logout por POST; sesión expirada con panel abierto y recarga de ruta profunda comprobadas.
- [ ] Build/tests, plan/bitácora y commit.

### Etapa 9 — Panel de carta e imágenes

**Dependencias:** 8. **Entrega:** CRUD completo desde navegador.

- [ ] Categorías: crear/editar/reordenar/borrar con conflictos y confirmación. Productos: filtros, paginación, activos/inactivos y formulario.
- [ ] Formulario separado del objeto original, validación de precio/categoría/nombre, doble envío bloqueado y cancelación sin mutar estado.
- [ ] Imagen opcional, conservar/reemplazar/quitar; upload multipart con CSRF, progreso/error y manejo de fallo al guardar referencia.
- [ ] Mostrar conflicto 409 de versión y ofrecer recarga, sin sobrescribir silenciosamente.
- [ ] Comprobar reflejo en web pública y prohibición de recursos ajenos incluso con petición manipulada.
- [ ] Build/tests, plan/bitácora y commit.

### Etapa 10 — Configuración y publicación desde el panel

**Dependencias:** 9. **Entrega:** owner administra contenido del sitio.

- [ ] Formularios de SiteContent/contacto/moneda/colores/medios con mismos límites del servidor; slug solo lectura.
- [ ] Publicación explícita, validación de requisitos y enlace por origin actual; cambios publicados visibles al recargar.
- [ ] Advertir que despublicar no vuelve privadas las imágenes ya accesibles y que cambiar moneda no convierte precios.
- [ ] Dashboard con categorías/productos activos/inactivos/publicación y acceso a sitio.
- [ ] Verificar owner/editor, edición concurrente y datos reales de La Terraza antes de habilitar publicación real.
- [ ] Build/tests, plan/bitácora y commit.

### Etapa 11 — Registro, verificación y recuperación

**Dependencias:** 10. **Entrega:** alta pública recuperable y cuentas verificadas.

- [ ] Backend de registro transaccional/outbox/tokens con contratos de sección 5; email confirmado antes del login.
- [ ] Verificación y reset consumen tokens una sola vez; hash, expiración, límites de frecuencia e invalidación de sesiones tras cambio de contraseña.
- [ ] Frontend registro/revisar correo/verificación/forgot/reset; tokens fuera de logs y analítica, limpiar URL después de leerlos y política Referrer-Policy adecuada.
- [ ] Worker de email reintentable, credenciales SMTP por entorno y limpieza de payload sensible enviado.
- [ ] Probar carreras de email/slug, fallo DB, fallo SMTP, respuesta perdida, reenvío, token caducado/usado y recuperación completa.
- [ ] Registro desactivado en backend hasta validar antiabuso y correo real. Build/tests, plan/bitácora y commit.

### Etapa 12 — Integración, operación y despliegue

**Dependencias:** 11. **Entrega:** versión candidata comprobada y despliegue recuperable.

- [ ] Tests backend `verify` con PostgreSQL real; Testcontainers requiere Docker operativo. Alternativa explícita: DB de pruebas aislada, nunca desarrollo compartido/producción. No declarar esas pruebas aprobadas si falta el runtime.
- [ ] E2E completo: registro→correo de pruebas→login→categoría/producto/foto→configuración/publicar→sitio→WhatsApp interceptado.
- [ ] Revisar móvil/teclado, errores, expiración y cambio de cuenta A/B sin contenido anterior.
- [ ] Preparar artefactos, proxy/HTTPS, volúmenes, healthchecks y secretos fuera de Git. Fallback SPA excluye `/api` y `/media`; un error API jamás devuelve index.html.
- [ ] Backups PostgreSQL y medios, prueba de restauración, logs sin secretos, límites de upload/login, rotación de logs y monitoreo de salud/disco/outbox.
- [ ] Verificar migraciones sobre copia de prueba, compatibilidad con versión anterior y reversión del frontend/backend. No usar migraciones destructivas como rollback improvisado.
- [ ] Elegir proveedor/dominio con configuración concreta antes de publicar. Publicación es un paso separado y requiere infraestructura/acceso disponibles; no contratar recursos implícitamente.
- [ ] Desplegar a staging, smoke tests y luego producción autorizada. No sembrar usuarios demo. Registrar versión/migraciones/resultados y commit de cierre.

## 8. Matriz mínima de aceptación

| Caso | Resultado |
|---|---|
| Visitante consulta publicado | Solo contenido público y carta activa |
| Visitante consulta borrador/inactivos por API | Sin acceso |
| Owner/editor A administra catálogo A | Permitido |
| A solicita/modifica ID de B | 404 y B intacto |
| Producto A referencia categoría/imagen B | Rechazo en servicio/constraint |
| Editor modifica configuración/publicación | 403 |
| Escritura sin CSRF | 403; sin mutación |
| Login y recarga de ruta protegida | Sesión restaurada antes del guard |
| Logout/reset de contraseña | Sesiones invalidadas según contrato |
| Categoría con productos se borra | 409; productos intactos |
| Reordenamiento inválido o ajeno | Sin cambios parciales |
| Dos editores guardan versión antigua | 409, sin sobrescritura silenciosa |
| Dos registros con email/slug igual | Constraint decide, sin altas parciales |
| SMTP falla después del alta | Cuenta consistente y outbox reintentable |
| Token expirado/usado | Rechazo sin cambiar cuenta |
| Upload simulado, excesivo o traversal | Rechazo sin archivo publicado |
| Editar sin nueva foto | Foto anterior conservada |
| Guardado falla tras upload | Archivo temporal/huérfano recuperable |
| Navegar A→B con respuesta tardía A | Solo B visible |
| Backend caído | Error recuperable, no falso 404/demo |
| Sitio vacío/sin imágenes | Estado vacío correcto |
| Reserva válida | WhatsApp preparado, no envío automático |

## 9. Seguimiento y criterios de cierre

**Orden:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12.

El backend se construye y prueba antes de conectar pantallas. La web estática permanece funcional durante las primeras etapas. No marcar una etapa completa solo por tener archivos o mocks: requiere sus verificaciones reales.

Actualizar las casillas de este archivo al terminar cada paso, no al final de toda la implementación. Bitácora por etapa: archivos, comandos/resultados, evidencia, pendientes y commit. Un bloqueo externo se registra explícitamente; se puede preparar trabajo independiente, pero no dar por superada una dependencia no verificada.

Este documento no certifica pruebas ejecutadas ni cambios de aplicación realizados. Tras la reversión, todas las etapas quedan pendientes.

## 10. Referencias de implementación

- [Spring Boot: requisitos](https://docs.spring.io/spring-boot/system-requirements.html): comprobar compatibilidad y fijar versiones al iniciar.
- [Spring Security: CSRF y SPA](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html): cookies, cabeceras, login/logout y multipart.
- [Spring Security: sesiones](https://docs.spring.io/spring-security/reference/7.0/servlet/authentication/session-management.html): persistencia del contexto y protección de sesión; consultar la versión correspondiente al Boot fijado.
- [PostgreSQL: constraints](https://www.postgresql.org/docs/17/ddl-constraints.html): claves compuestas, restricciones y borrados.
