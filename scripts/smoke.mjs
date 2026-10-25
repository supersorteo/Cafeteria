#!/usr/bin/env node
// Verificación rápida tras un despliegue.
//   node scripts/smoke.mjs https://tu-app.vercel.app [slug-publicado] [--backend https://tu-backend.up.railway.app]
// Sale con código 1 si algo falla. No crea datos ni inicia sesión.

const args = process.argv.slice(2);
const backendFlag = args.indexOf('--backend');
const backend = backendFlag >= 0 ? args.splice(backendFlag, 2)[1] : null;
const [frontend, slug] = args;

if (!frontend) {
  console.error('Uso: node scripts/smoke.mjs <url-del-frontend> [slug] [--backend <url-del-backend>]');
  process.exit(2);
}

const base = frontend.replace(/\/$/, '');
let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? ' OK ' : 'FALLA'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};
const get = async (url, init) => {
  try {
    return await fetch(url, { redirect: 'manual', ...init });
  } catch (error) {
    return { status: 0, headers: new Headers(), text: async () => '', error };
  }
};

console.log(`Frontend: ${base}${backend ? `\nBackend:  ${backend}` : ''}\n`);

const home = await get(`${base}/`);
const html = await home.text();
check(home.status === 200 && html.includes('<app-root'), 'La página principal carga la aplicación', `HTTP ${home.status}`);
const csp = home.headers.get('content-security-policy') ?? '';
check(csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'self'"), 'Política de seguridad de contenido (CSP) activa');
check(home.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
check(home.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN');
check(home.headers.get('referrer-policy') === 'no-referrer', 'Referrer-Policy: no-referrer');
check((home.headers.get('strict-transport-security') ?? '').includes('max-age='), 'HSTS activo');

const login = await get(`${base}/auth/login`);
check(login.status === 200 && (await login.text()).includes('<app-root'), 'Una ruta profunda (/auth/login) recarga bien', `HTTP ${login.status}`);

const csrf = await get(`${base}/api/v1/auth/csrf`);
const csrfCookie = csrf.headers.get('set-cookie') ?? '';
check(csrf.status === 200 && csrfCookie.includes('XSRF-TOKEN='), '/api llega al backend y emite el token CSRF', `HTTP ${csrf.status}`);

const missing = await get(`${base}/api/v1/public/sites/este-sitio-no-existe-${Date.now()}`);
const missingBody = await missing.json?.().catch(() => null);
check(missing.status === 404 && missingBody?.code === 'not_found', 'Un sitio inexistente devuelve 404 estructurado');

const me = await get(`${base}/api/v1/auth/me`);
check(me.status === 401, 'El panel exige sesión (/auth/me → 401)', `HTTP ${me.status}`);

const admin = await get(`${base}/api/v1/admin/dashboard`);
check(admin.status === 401, 'La API de administración exige sesión', `HTTP ${admin.status}`);

const noCsrf = await get(`${base}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'username=x@x.test&password=x',
});
check(noCsrf.status === 403, 'Una escritura sin token CSRF se rechaza (403)', `HTTP ${noCsrf.status}`);

if (slug) {
  const site = await get(`${base}/api/v1/public/sites/${encodeURIComponent(slug)}`);
  const data = await site.json?.().catch(() => null);
  check(site.status === 200 && data?.slug === slug, `El sitio público «${slug}» responde`, `HTTP ${site.status}`);
  if (data) {
    const leaked = ['passwordHash', 'tenantId', 'version', 'createdAt', 'email_verified'].filter(key => JSON.stringify(data).includes(key));
    check(leaked.length === 0, 'La respuesta pública no expone datos internos', leaked.join(', '));
    const image = data.hero?.imageUrl ?? data.categories?.flatMap(c => c.items).find(i => i.imageUrl)?.imageUrl;
    if (image) {
      const url = image.startsWith('http') ? image : `${base}${image}`;
      const response = await get(url);
      check([200, 301, 302].includes(response.status), 'Las imágenes del sitio se sirven', `HTTP ${response.status}`);
    }
  }
}

if (backend) {
  const target = backend.replace(/\/$/, '');
  const health = await get(`${target}/actuator/health`);
  const healthBody = await health.json?.().catch(() => null);
  check(health.status === 200 && healthBody?.status === 'UP', 'Backend: /actuator/health está UP', `HTTP ${health.status}`);
  for (const path of ['/actuator/env', '/actuator/heapdump', '/actuator/beans']) {
    const response = await get(`${target}${path}`);
    check([401, 403, 404].includes(response.status), `Backend: ${path} no está expuesto`, `HTTP ${response.status}`);
  }
}

console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} comprobación(es) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
