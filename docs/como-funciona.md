# Cómo funciona la app y cómo probarla en local

## Mapa de pantallas

| URL | Qué es | Quién entra |
|---|---|---|
| `/` | Portada de la plataforma: «Crear mi negocio», «Iniciar sesión», «Ver un ejemplo» | Todos |
| `/auth/register` | Registro de un negocio nuevo (correo, contraseña, nombre y dirección/slug) | Visitantes |
| `/auth/login` | Inicio de sesión | Visitantes |
| `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification` | Enlaces de los correos | Visitantes |
| `/admin` | Panel: resumen y estado de publicación | Sesión iniciada |
| `/admin/menu` | Categorías, platos, precios e imágenes | Sesión iniciada |
| `/admin/setup` | **Asistente** «Configura tu negocio»: 9 pasos guiados con vista previa en vivo | Sesión iniciada |
| `/admin/site` | **Configuración**: lista numerada de los 9 pasos con su estado; cada paso se edita en un modal (solo el dueño guarda) | Sesión iniciada |
| `/:slug` (ej. `/la-terraza`) | Página pública de cada negocio; 404 si no está publicada | Todos |

Cada negocio (tenant) es independiente: su sesión solo ve y edita sus datos. El identificador del negocio sale siempre de la sesión en el servidor, nunca del navegador.

## Flujo de un negocio real

1. Entra a `/` → «Crear mi negocio» → completa el registro.
2. Recibe un correo con un enlace de verificación (en local, por el Gmail configurado; con `mail.sender=log` el enlace sale en la consola del backend).
3. Al abrir el enlace, el navegador siempre lo abre en una pestaña nueva. Si la pestaña del registro sigue abierta (mismo navegador), pasa sola al inicio de sesión con el aviso «Correo confirmado»; la pestaña nueva indica que ya puede cerrarse. Si no hay otra pestaña (otro navegador o el móvil), la nueva cuenta atrás de 3 s y lo lleva al inicio de sesión.
4. Inicia sesión → llega a `/admin`.
5. Entra al asistente desde la tarjeta «Configura tu negocio» del resumen y sigue los 9 pasos (ver más abajo).
6. Pulsa **Publicar** (el dueño). Desde ese momento `https://tu-dominio/su-slug` es público.
7. Quien quiera volver al panel usa «Acceso para negocios» (pie de la portada y de cada página pública).

## Probar en local

Requisitos: Java 21, Node 24, PostgreSQL en marcha con la base configurada en `application.properties`.

```bash
# Terminal 1: backend (http://localhost:8080)
cd cafeteria/cafeteria
./mvnw spring-boot:run

# Terminal 2: frontend (http://localhost:4200)
cd BAR-LA-TERRAZA
npm install
npm start
```

**No hay variables de entorno en el frontend.** Llama siempre a `/api` y `/media` en su propio origen: en local, `proxy.conf.json` los reenvía a `localhost:8080`; en producción, `vercel.json` los reenvía a Railway. Así no hay CORS y las cookies de sesión son de primera parte. La única URL que hay que configurar es la de Railway dentro de `vercel.json`.

**Configuración local del backend** (`cafeteria/cafeteria/src/main/resources/application.properties`, fuera de git; plantilla en `application.properties.example`):

| Propiedad | Para qué |
|---|---|
| `spring.datasource.*` | Tu PostgreSQL local |
| `media.storage=local` | Las imágenes se guardan en la carpeta `uploads/` |
| `mail.sender=log` | Los correos no se envían: el enlace se imprime en la consola del backend |
| `registration.enabled=true` | Registro abierto |
| `seed.dev.enabled=true` + `seed.dev.password` | Crea datos de demostración al arrancar |

### Cuentas de demostración (solo local)

La contraseña es el valor de `seed.dev.password` de tu `application.properties`.

| Correo | Negocio | Rol |
|---|---|---|
| `owner-a@laterraza.test` | La Terraza (`/la-terraza`, publicado) | Dueño |
| `editor-a@laterraza.test` | La Terraza | Editor (no publica ni cambia ajustes) |
| `owner-b@bistro.test` | Bistro Demo (`/bistro-demo`) | Dueño |

### Probar el registro de un negocio nuevo

1. `http://localhost:4200/` → «Crear mi negocio».
2. Completa el formulario. En la consola del backend busca la línea del correo con el enlace `/auth/verify-email?token=...` y ábrelo en el navegador.
3. Inicia sesión, carga la carta y publica. Tu página queda en `http://localhost:4200/<tu-slug>`.

## Panel de superadmin

Panel privado para el dueño de la plataforma: lista todos los negocios con su dueño, y permite **suspender, reactivar y eliminar**.

- **Cómo entrar:** pulsa **Ctrl+Alt+P** en cualquier página (se abre un formulario) o ve a `/superadmin` (en móvil y tableta). No hay enlaces visibles.
- **Acceso en dos pasos:** correo y contraseña (variables `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` del servidor) y después un código de 6 dígitos que llega a ese correo (caduca en 10 minutos, 5 intentos). La sesión se cierra a los 15 minutos sin actividad.
- **Sesión independiente de la de los negocios:** usa su propia cookie (`SA_SESSION`, solo para `/api/v1/superadmin`, `HttpOnly` y `SameSite=Strict`), distinta de la de los dueños (`SESSION`). Puedes tener abierta tu sesión de dueño y la de superadmin en el mismo navegador sin que una pise o cierre a la otra, y no se guarda nada del superadmin en `localStorage`. Los campos de acceso desactivan el autocompletado del navegador para no mezclar contraseñas.
- **Salir sin cerrar sesión:** el botón «Ir al inicio» te saca del panel y mantiene la sesión (al volver con Ctrl+Alt+P entras directo); «Cerrar sesión» sí la termina.
- **Suspender:** el sitio público y las fotos del negocio dan 404, su dueño y editores no pueden entrar y sus sesiones se cierran. No se borra nada; **Reactivar** lo deja como estaba.
- **Eliminar:** solo si está suspendido y escribiendo su dirección. Borra el negocio, su carta, sus fotos (también los archivos) y sus usuarios. No se puede deshacer.
- **Actividad:** registro de cada suspensión, reactivación y eliminación (quién, cuándo, IP).
- Todo es responsive: tabla en escritorio, tarjetas en móvil.

## Estructura de despliegue

```
BAR-LA-TERRAZA/  (repo Cafeteria → Vercel)
  vercel.json         reescrituras /api y /media → Railway, cabeceras, SPA
  proxy.conf.json     lo mismo, solo para `npm start`
cafeteria/cafeteria/  (repo CafeteriaBack → Railway)
  Dockerfile, railway.json
  application.properties            LOCAL (no se versiona)
  application-production.properties PRODUCCIÓN (todo por variables de entorno)
```

Pasos de despliegue: `docs/deployment.md`.

## Botones de retorno

- **Demo → plataforma:** «Ver un ejemplo» abre el sitio en la misma pestaña con `?ref=plataforma`; el sitio muestra abajo «Volver a Deliora» y «Crear mi negocio». Sin el parámetro (clientes reales de un negocio) no aparece nada.
- **Panel → sitio:** «Ver mi sitio» (menú, barra superior, cuenta, resumen y enlace de publicación) abre en la misma pestaña con `?ref=panel`; con sesión iniciada aparece «Volver al panel de administración». Si el sitio está en borrador se ve la pantalla 404 con ese mismo botón y el aviso de publicarlo desde Mi sitio.
- `ref` es solo una pista de interfaz: no da acceso a nada.

## Configurar el negocio por pasos

Los pasos siguen las secciones de la página pública (lo que rellenas es lo que se ve) y están ordenados por importancia:

| # | Paso | ¿Hace falta? | Lo ve tu cliente en |
|---|---|---|---|
| 1 | **Tu negocio**: nombre, tipo, **WhatsApp**, moneda, idioma, zona horaria | Necesario para publicar (el WhatsApp) | Nombre arriba y botón «Reservar» |
| 2 | **Tu marca**: logo y colores | Puedes hacerlo después | Logo arriba; botones y detalles con tus colores |
| 3 | **Tu portada**: frase de bienvenida, título, descripción, foto principal, cinta de frases | Puedes hacerlo después | Lo primero que ve al abrir tu página |
| 4 | **Tu carta**: categorías y productos | Muy recomendable | Sección «La carta» |
| 5 | **Tu historia**: título, texto, fotos y números destacados | Puedes hacerlo después | Sección «Nosotros» |
| 6 | **Tus espacios y fotos**: cada espacio (Terraza, Salón, Barra…) con foto, nombre, descripción y «Acepta reservas»; más fotos del ambiente | Puedes hacerlo después | Sección «El ambiente», con «Reservar aquí» en cada espacio |
| 7 | **Reservas por WhatsApp**: tamaños de grupo (las zonas salen de los espacios que aceptan reservas) | Puedes hacerlo después (hay valores por defecto) | Formulario de reserva |
| 8 | **Contacto y horarios**: teléfono, correo, dirección, horarios, mensaje final | Puedes hacerlo después | Final de la página |
| 9 | **Publicar tu página** (con resumen de lo que falta) | Último paso | Toda la página |

Cada paso muestra un cuadro «¿Para qué sirve?» con qué haces, un ejemplo y cómo lo verá tu cliente.

Hay dos formas de recorrerlos, con los mismos formularios:

- **Asistente** (`/admin/setup`): un paso a la vez con barra de progreso, selector de pasos y botones **Atrás · Omitir · Guardar y continuar**. Los pasos opcionales se pueden omitir; el paso de la carta lleva a la pantalla Carta y vuelve con «← Volver a la configuración». Si hay cambios sin guardar, pide confirmación antes de salir del paso.
- **Lista numerada** (`/admin/site`, «Configuración»): los 9 pasos con su estado (Listo / Necesario para publicar / Muy recomendable / Puedes hacerlo después), con icono, qué haces, un ejemplo y dónde lo ve tu cliente; **Editar** abre el paso en un modal.

**Vista previa en vivo, en formato teléfono:** el botón **«Vista previa»** está arriba (en la cabecera del asistente y en la cabecera de cada modal). Muestra tu página pública real dentro de un teléfono de 390 px (con un viewport de verdad, así que ves exactamente la versión móvil), desplazada y resaltada en la sección del paso. Lo que escribes aparece al instante, antes de guardar; las fotos nuevas se ven cuando las guardas. En pantallas anchas (≥ 1280 px) el teléfono queda acoplado junto al formulario y se oculta con el mismo botón; en pantallas más pequeñas se abre como un **panel lateral** que se desliza desde la derecha (en el móvil ocupa toda la pantalla). Se cierra con ✕, tocando fuera o con Escape.

El resumen (`/admin`) muestra «N de 9 pasos completos» y el botón «Continuar con el asistente», que abre el primer paso pendiente. Los pasos se marcan como completos por los datos guardados (por ejemplo, el paso 1 cuando hay WhatsApp; el paso 3 cuando hay una categoría con un producto activo).
