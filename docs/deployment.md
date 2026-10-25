# Despliegue: Railway (backend) + Vercel (frontend) + Gmail

## Arquitectura

```
Navegador ──► Vercel (Angular estático + reescrituras)
                 ├─ /api/*   ──► Railway: Spring Boot ──► PostgreSQL (Railway, red privada)
                 ├─ /media/* ──► Railway (redirige a Cloudinary en producción)
                 └─ resto    ──► index.html (SPA)
Spring Boot ──► Cloudinary (imágenes)   ──► API de Gmail por HTTPS (correo)
```

El navegador solo habla con el dominio de Vercel: las cookies de sesión y el CSRF son del mismo origen, sin CORS ni cookies de terceros.
El backend ve las peticiones a través de Vercel y Railway, por eso lee la IP real del cliente en `X-Forwarded-For` (`security.trust-forwarded-for=true`).

## 0. Antes de empezar (obligatorio)

**Rota las credenciales que estuvieron en el repositorio.** El primer commit del backend, ya subido a GitHub, contiene `application.properties` con la contraseña de tu PostgreSQL local y el secreto de la API de Cloudinary. Quitarlos de ahora en adelante no los borra del historial.

1. Cloudinary → Settings → API Keys → genera una clave nueva y revoca la anterior.
2. Cambia la contraseña de tu PostgreSQL local y actualiza tu `application.properties` local.
3. Deja de versionar el archivo local (el `.gitignore` ya lo ignora, pero está rastreado):

```bash
cd cafeteria/cafeteria
git rm --cached src/main/resources/application.properties
git add .gitignore src/main/resources/application.properties.example src/main/resources/application-production.properties
git commit -m "Dejar de versionar la configuración local"
git push
```

4. Opcional, para quitarlo también del historial (hoy es un solo commit): `git commit --amend` tras el `git rm --cached` y `git push --force`. Aun así, trata las credenciales anteriores como comprometidas.

## 1. Gmail (correo de verificación y recuperación)

**Railway bloquea el SMTP saliente (puertos 25, 465 y 587) en los planes Free, Trial y Hobby**; solo lo permite el plan Pro. Por eso el camino recomendado es la **API de Gmail por HTTPS** (`MAIL_SENDER=gmail-api`), que funciona en cualquier plan.

1. <https://console.cloud.google.com> → crea un proyecto → *APIs y servicios* → *Biblioteca* → habilita **Gmail API**.
2. *Pantalla de consentimiento OAuth*: tipo **Externo**; añade el alcance `https://www.googleapis.com/auth/gmail.send` y tu Gmail como usuario de prueba. **Publícala («En producción»)**: mientras esté en «Prueba», el refresh token caduca a los 7 días. Sin verificar, Google muestra un aviso al autorizar; para uso propio basta con «Avanzado → continuar».
3. *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* → tipo **Aplicación web** → URI de redirección `https://developers.google.com/oauthplayground`. Guarda el *Client ID* y el *Client secret*.
4. <https://developers.google.com/oauthplayground> → engranaje → «Use your own OAuth credentials» → pega tus credenciales → paso 1: escribe el alcance `https://www.googleapis.com/auth/gmail.send` → *Authorize APIs* con tu cuenta de Gmail → paso 2: *Exchange authorization code for tokens* → copia el **Refresh token**.

Variables: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` y `MAIL_FROM` (la misma dirección de Gmail que autorizó). Los correos salen de esa cuenta y quedan en su carpeta «Enviados».

Límites: una cuenta personal de Gmail permite unos 500 destinatarios al día. Si lo superas, pasa a un servicio de correo transaccional.

**Alternativa (plan Pro de Railway):** `MAIL_SENDER=smtp`, `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USERNAME=<tu gmail>`, `MAIL_PASSWORD=<contraseña de aplicación>` (requiere verificación en dos pasos) y `MAIL_FROM`.

## 2. Railway (backend)

1. *New Project* → *Deploy PostgreSQL*.
2. *New* → *GitHub Repo* → `CafeteriaBack` (directorio raíz `/`). Railway usa el `Dockerfile` y el `railway.json` (healthcheck en `/actuator/health`).
3. En *Variables* del servicio del backend:

| Variable | Valor |
|---|---|
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | `${{Postgres.PGHOST}}`, `${{Postgres.PGPORT}}`, … (referencias al servicio PostgreSQL; ajusta «Postgres» si lo renombraste) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | credenciales **nuevas** de Cloudinary |
| `APP_PUBLIC_BASE_URL` | `https://tu-app.vercel.app` (sin barra final; es la base de los enlaces de los correos) |
| `MAIL_FROM`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | ver paso 1 |
| `REGISTRATION_ENABLED` | `true` para abrir el registro (por defecto está cerrado) |
| Opcionales | `MAIL_SENDER` (`gmail-api` por defecto), `DB_POOL_SIZE` (10), `DB_URL`/`DB_USER`/`DB_PASSWORD` si no usas las `PG*` |

   `PORT` lo pone Railway. `SPRING_PROFILES_ACTIVE=production` ya viene en la imagen.
4. *Settings → Networking → Generate Domain* y copia `https://xxxx.up.railway.app`.
5. En los *Deploy Logs* debe aparecer `The following 1 profile is active: "production"` y `Started CafeteriaApplication`. Flyway crea el esquema en el primer arranque.

El perfil de producción es autosuficiente: no depende de `application.properties`. Si falta una variable obligatoria (`APP_PUBLIC_BASE_URL`, `MAIL_FROM`, `CLOUDINARY_*`, o las `GMAIL_*` con `gmail-api`), la aplicación falla al arrancar con un mensaje claro, en lugar de fallar al enviar el primer correo.

## 3. Vercel (frontend)

1. En el repo `Cafeteria`, edita `vercel.json`: reemplaza `https://TU-BACKEND.up.railway.app` (2 apariciones) por el dominio de Railway, haz commit y push.
2. Vercel → *Add New → Project* → importa el repo. Instalación, build y salida vienen de `vercel.json`.
3. *Settings → General → Node.js Version*: `24.x` (Angular exige ≥ 24.15).
4. Despliega y copia el dominio (`https://tu-app.vercel.app`). Vuelve a Railway, pon ese valor en `APP_PUBLIC_BASE_URL` y redespliega.
5. Dominio propio (opcional): añádelo en Vercel y actualiza `APP_PUBLIC_BASE_URL`.

## 4. Primer arranque

- La raíz `/` es la portada de la plataforma (registro, login y enlace de ejemplo). El enlace «Ver un ejemplo» apunta a `/la-terraza`: regístrate con esa dirección o cambia el enlace en `src/app/home/home.page.ts`.
- No se siembran datos en producción. Regístrate en `/auth/register`, confirma el correo, carga tu carta, completa «Mi sitio» y publica.
- Cuando los negocios que quieras estén dados de alta, pon `REGISTRATION_ENABLED=false` si no quieres registro abierto.

## 5. Comprobación tras desplegar

```bash
node scripts/smoke.mjs https://tu-app.vercel.app la-terraza --backend https://xxxx.up.railway.app
```

Comprueba cabeceras de seguridad, rutas profundas, `/api` a través de Vercel, que el panel exija sesión, que una escritura sin CSRF se rechace, que el sitio público no exponga datos internos y que Actuator solo exponga `health`.

Luego, a mano: registrarte → recibir el correo → verificar → entrar → subir una imagen de unos 4,9 MB (ver «Riesgos») → publicar → reservar por WhatsApp.

## 6. Operación

**Migración V4 (espacios).** Mueve datos (tarjetas y zonas de reserva pasan a `site_spaces`). Haz una copia de seguridad antes y despliega primero el backend: la API sigue devolviendo `highlights` y `reservationAreas` derivados, así que el frontend anterior no se rompe mientras despliegas el nuevo.

**Copias de seguridad (PostgreSQL).** Railway → servicio PostgreSQL → *Variables* → `DATABASE_PUBLIC_URL` (activa el proxy TCP público solo mientras hagas la copia):

```bash
pg_dump "$DATABASE_PUBLIC_URL" --format=custom --no-owner -f copia-$(date +%F).dump
# prueba de restauración en una base vacía
createdb prueba_restauracion
pg_restore --no-owner -d prueba_restauracion copia-2026-01-01.dump
```

Haz una copia antes de cada despliegue que incluya migraciones y al menos una vez por semana, y comprueba la restauración. Las imágenes viven en Cloudinary y se referencian desde `media_assets`; la copia de la base basta para reconstruir las referencias.

**Rollback.** Railway: *Deployments* → redesplegar la versión anterior. Vercel: *Deployments* → promover la anterior. Las migraciones de Flyway solo avanzan: escribe migraciones compatibles con la versión anterior (columnas nuevas opcionales) y, si una migración falla a medias, restaura la copia.

**Monitorización.** Un monitor externo gratuito (p. ej. UptimeRobot) sobre `https://xxxx.up.railway.app/actuator/health`. Revisa de vez en cuando correos fallidos: `select count(*) from email_outbox where status = 'FAILED';`.

**Secretos.** Solo en las variables de Railway/Vercel, nunca en git. Rótalos si los expones o cada pocos meses.

## 7. Riesgos y límites conocidos

- **SMTP en Railway**: bloqueado fuera del plan Pro (por eso la API de Gmail).
- **Cuota de Gmail**: ~500 destinatarios/día en una cuenta personal.
- **Subida de imágenes por Vercel**: no encontré documentado un límite de tamaño de petición para las reescrituras a un origen externo (las *Functions* tienen 4,5 MB). El backend acepta hasta 5 MiB. Prueba con una imagen de ~4,9 MB; si falla con 413, hay que comprimir en el navegador antes de subir o subir directo al backend.
- **Límite de intentos por IP**: se basa en `X-Forwarded-For`, que Vercel establece con la IP real. Alguien que ataque directamente el dominio de Railway podría falsearla; un techo global por ruta (10× el límite por IP) frena la rotación masiva de IP falsas. Si quieres más protección, no publiques el dominio de Railway y limita el acceso.
- **Varias réplicas**: la cola de correos y la limpieza de imágenes admiten varias réplicas; el límite de intentos es en memoria y por réplica.
- **La Terraza real**: los datos de demostración (seed) no existen en producción; se cargan desde el panel.

## Nota sobre la vista previa del panel

La vista previa en formato teléfono carga la ruta `/admin/preview` de la propia aplicación dentro de un `<iframe>`. Por eso `vercel.json` usa `frame-ancestors 'self'` y `X-Frame-Options: SAMEORIGIN` (antes `'none'` y `DENY`): solo la propia aplicación puede incrustar sus páginas; ningún otro sitio puede hacerlo. `scripts/smoke.mjs` comprueba estas cabeceras. La ruta `/admin/preview` no muestra datos por sí sola: solo pinta lo que le envía la ventana padre del mismo origen mediante `postMessage`.
