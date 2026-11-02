/**
 * Form validation helpers for the auth module.
 * Rules mirror the backend contract (new password ≥ 8 chars, ≤ 72 UTF-8 bytes, required name/email).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Please enter your name';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Please enter your email address';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Please enter a password';
  if (password.length < 8) return 'Password must be at least 8 characters';
  let bytes = 0;
  for (const character of password) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  if (bytes > 72) return 'Password must be 72 UTF-8 bytes or fewer';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}
