import crypto from "crypto";

export function generateRandomId() {
  const array = new Uint32Array(1);
  const cr = typeof window === 'undefined' ? crypto : window.crypto;
  (cr as typeof crypto).getRandomValues(array);
  return array[0].toString(16);
}