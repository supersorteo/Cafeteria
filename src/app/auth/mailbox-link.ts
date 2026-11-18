export interface MailboxLink {
  provider: string;
  url: string;
}

export function mailboxLink(email: string): MailboxLink | null {
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf('@') + 1);
  if (!address.includes('@') || !domain) {
    return null;
  }
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { provider: 'Gmail', url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(address)}` };
  }
  if (['outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'live.com', 'msn.com'].includes(domain)) {
    return { provider: 'Outlook', url: 'https://outlook.live.com/mail/' };
  }
  if (domain === 'yahoo.com' || domain === 'yahoo.es' || domain === 'ymail.com') {
    return { provider: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  }
  if (domain === 'icloud.com' || domain === 'me.com') {
    return { provider: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  }
  if (domain === 'proton.me' || domain === 'protonmail.com') {
    return { provider: 'Proton Mail', url: 'https://mail.proton.me/' };
  }
  return null;
}
