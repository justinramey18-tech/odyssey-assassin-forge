// Recovery code utilities — used at signup and from Account Settings.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusing chars

/** Generate a 16-character recovery code grouped XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += '-';
  }
  return out;
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}
