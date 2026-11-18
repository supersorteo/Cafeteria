import { mailboxLink } from './mailbox-link';

describe('mailboxLink', () => {
  it('should point to the right inbox for the common providers', () => {
    expect(mailboxLink('a@gmail.com')?.provider).toBe('Gmail');
    expect(mailboxLink('a@hotmail.com')?.url).toBe('https://outlook.live.com/mail/');
    expect(mailboxLink('a@yahoo.com')?.provider).toBe('Yahoo Mail');
    expect(mailboxLink('a@icloud.com')?.provider).toBe('iCloud Mail');
    expect(mailboxLink('a@proton.me')?.provider).toBe('Proton Mail');
  });

  it('should return nothing for a custom domain or a malformed address', () => {
    expect(mailboxLink('a@minegocio.com')).toBeNull();
    expect(mailboxLink('sin-arroba')).toBeNull();
    expect(mailboxLink('')).toBeNull();
  });
});
