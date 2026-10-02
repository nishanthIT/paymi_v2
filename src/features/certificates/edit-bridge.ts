import type { ShopCertificate } from './api';

/** Hands a certificate from the details screen back to the list screen's edit form. */
let listener: ((certificate: ShopCertificate) => void) | null = null;

export function subscribeCertificateEdit(callback: (certificate: ShopCertificate) => void) {
  listener = callback;
  return () => {
    if (listener === callback) listener = null;
  };
}

export function emitCertificateEdit(certificate: ShopCertificate) {
  listener?.(certificate);
}
