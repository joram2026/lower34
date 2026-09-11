/**
 * Email validation utility for CME Markets
 * Handles format checking, disposable email detection, and domain typo suggestions.
 */

// Popular disposable/temporary email provider domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'throwawaymail.com',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'crazymailing.com',
  'mohmal.com',
  'generator.email',
  'emailondeck.com',
  'burnermail.io',
  'maildrop.cc',
  'inboxkitten.com',
  'mytemp.email',
  'tempr.email',
  'discard.email',
  'disposablemail.com',
  'tempail.com',
  'nada.ltd'
]);

// Common domain typos mapped to correct domains
const COMMON_TYPOS: Record<string, string> = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmaild.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmaik.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yaho.con': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloock.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'icloude.com': 'icloud.com',
  'prtonmail.com': 'protonmail.com',
  'protonmai.com': 'protonmail.com',
  'protnmail.com': 'protonmail.com',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validates an email address against syntax rules, disposable provider blacklists,
 * and checks for common typo suggestions.
 */
export function validateEmailAddress(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }

  // RFC 5322 standard-compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@example.com).' };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email format.' };
  }

  const [localPart, domain] = parts;

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email username is too long.' };
  }

  if (domain.length > 255 || !domain.includes('.')) {
    return { isValid: false, error: 'Please enter a valid domain name.' };
  }

  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) {
    return { isValid: false, error: 'Email top-level domain is invalid.' };
  }

  // Check disposable email providers
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Temporary/disposable email addresses are not allowed. Please use a permanent email address (e.g. Gmail, Outlook, Yahoo).'
    };
  }

  // Check common typos
  let suggestion: string | undefined;
  if (COMMON_TYPOS[domain]) {
    suggestion = `${localPart}@${COMMON_TYPOS[domain]}`;
  }

  return {
    isValid: true,
    suggestion
  };
}
