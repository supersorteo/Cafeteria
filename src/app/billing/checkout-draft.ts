const DRAFT_KEY = 'deliora.compra';
const CODE_KEY = 'deliora.codigo';
const DRAFT_MINUTES = 60;
const CODE_MINUTES = 15;

export interface CheckoutDraft {
  plan: string;
  region: string;
  method: string;
  businessName: string;
  slug: string;
  email: string;
}

function read<T>(key: string, minutes: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as T & { savedAt: number };
    if (Date.now() - value.savedAt > minutes * 60_000) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function write(key: string, value: object): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    return;
  }
}

export function saveDraft(draft: CheckoutDraft): void {
  write(DRAFT_KEY, draft);
}

export function loadDraft(): CheckoutDraft | null {
  return read<CheckoutDraft>(DRAFT_KEY, DRAFT_MINUTES);
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(CODE_KEY);
  } catch {
    return;
  }
}

export function saveEmailCode(email: string, code: string): void {
  write(CODE_KEY, { email: email.trim().toLowerCase(), code });
}

export function takeEmailCode(email: string): string | null {
  const saved = read<{ email: string; code: string }>(CODE_KEY, CODE_MINUTES);
  if (!saved || saved.email !== email.trim().toLowerCase()) {
    return null;
  }
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {
    return saved.code;
  }
  return saved.code;
}

export interface Mailbox {
  name: string;
  url: string;
}

export function mailboxFor(raw: string): Mailbox | null {
  const email = raw.trim().toLowerCase();
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { name: 'Gmail', url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}` };
  }
  if (/^(hotmail|outlook|live|msn)\.[a-z.]+$/.test(domain)) {
    return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/inbox' };
  }
  if (/^(yahoo|ymail)\.[a-z.]+$/.test(domain)) {
    return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  }
  return null;
}
