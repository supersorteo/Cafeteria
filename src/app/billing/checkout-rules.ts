export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

const KNOWN_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com',
  'hotmail.com.ar', 'yahoo.com.ar', 'outlook.es', 'hotmail.es', 'live.com.ar', 'adinet.com.uy', 'vera.com.uy',
];

export function emailProblem(raw: string): string | null {
  const email = raw.trim();
  if (!email) {
    return 'Escribe tu correo.';
  }
  if (/\s/.test(email)) {
    return 'El correo no puede tener espacios.';
  }
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) {
    return 'Falta la @ o hay más de una. Ejemplo: nombre@gmail.com';
  }
  if (!email.slice(at + 1).includes('.')) {
    return 'Falta el dominio completo. Ejemplo: nombre@gmail.com';
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Revisa el formato del correo. Ejemplo: nombre@gmail.com';
  }
  return null;
}

export function emailSuggestion(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) {
    return null;
  }
  const domain = email.slice(at + 1);
  if (domain.length < 5 || KNOWN_DOMAINS.includes(domain)) {
    return null;
  }
  let best: string | null = null;
  let bestDistance = 3;
  for (const known of KNOWN_DOMAINS) {
    const distance = editDistance(domain, known);
    if (distance < bestDistance) {
      best = known;
      bestDistance = distance;
    }
  }
  return best ? `${email.slice(0, at)}@${best}` : null;
}

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) {
    rows[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

export interface PasswordRule {
  key: 'length' | 'letter' | 'number';
  label: string;
  ok: boolean;
}

export function passwordRules(value: string): PasswordRule[] {
  return [
    { key: 'length', label: 'Entre 10 y 72 caracteres', ok: value.length >= 10 && value.length <= 72 },
    { key: 'letter', label: 'Al menos una letra', ok: /\p{L}/u.test(value) },
    { key: 'number', label: 'Al menos un número', ok: /\d/.test(value) },
  ];
}

export function passwordProblem(value: string): string | null {
  if (!value) {
    return 'Elige una contraseña.';
  }
  const missing = passwordRules(value).filter(rule => !rule.ok);
  if (missing.length === 0) {
    return null;
  }
  if (missing[0].key === 'length') {
    return value.length > 72 ? 'La contraseña puede tener hasta 72 caracteres.' : 'La contraseña debe tener al menos 10 caracteres.';
  }
  return `Agrega ${missing.map(rule => (rule.key === 'letter' ? 'una letra' : 'un número')).join(' y ')}.`;
}
