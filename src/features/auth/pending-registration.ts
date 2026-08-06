/**
 * In-memory holder for registration details between the register form and the
 * OTP verification screen. Kept out of router params so the password never
 * appears in navigation state or logs.
 */
export interface PendingRegistration {
  name: string;
  email: string;
  password: string;
}

let pending: PendingRegistration | null = null;

export function setPendingRegistration(data: PendingRegistration) {
  pending = data;
}

export function getPendingRegistration(): PendingRegistration | null {
  return pending;
}

export function clearPendingRegistration() {
  pending = null;
}
