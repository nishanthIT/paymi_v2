/**
 * Form validation helpers for the auth module.
 * Rules mirror the backend contract (password ≥ 6 chars, required name/email).
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
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}
