# Frontend en Vercel

Guía completa: `docs/deployment.md` del proyecto (Railway, Gmail, copias de seguridad, riesgos).

## Pasos
1. Edita `vercel.json`: sustituye `https://TU-BACKEND.up.railway.app` (2 veces) por el dominio público de tu backend en Railway. Commit y push.
2. Vercel → *Add New → Project* → importa este repositorio. Instalación, build y carpeta de salida (`dist/bar-la-terraza/browser`) vienen de `vercel.json`.
3. *Settings → General → Node.js Version*: `24.x`.
4. Despliega, copia el dominio y ponlo en `APP_PUBLIC_BASE_URL` del backend (Railway); redespliega el backend.

## Qué hace `vercel.json`
- Reescribe `/api/*` y `/media/*` hacia el backend (el navegador solo ve un origen: cookies de sesión y CSRF sin CORS).
- Cualquier otra ruta sirve `index.html` (aplicación de una sola página); los archivos estáticos tienen prioridad.
- Cabeceras de seguridad: CSP estricta (`script-src 'self'`, imágenes de Cloudinary permitidas), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS.
- Caché larga e inmutable para `*.js`, `*.css`, `*.woff2` con hash.

Si añades un servicio externo (analítica, fuentes, etc.), amplía la CSP en `vercel.json`.

## Verificación tras el despliegue
```bash
node scripts/smoke.mjs https://tu-app.vercel.app la-terraza --backend https://xxxx.up.railway.app
```

## Desarrollo local
`npm start` usa `proxy.conf.json` hacia `http://localhost:8080`. Tests: `npm test -- --watch=false`.
