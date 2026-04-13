import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Szyfruje tekst (np. klucz API) za pomocą AES-256-GCM.
 * Zwraca ciąg w formacie: iv:authTag:encryptedText (zakodowany w base64)
 */
export function encryptKey(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }

  // Klucz musi mieć dokładnie 32 bajty dla aes-256
  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64 encoded)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Łączymy IV, tag autoryzacyjny i zaszyfrowany tekst
  const result = `${iv.toString('hex')}:${authTag}:${encrypted}`;
  return Buffer.from(result).toString('base64');
}

/**
 * Deszyfruje tekst zaszyfrowany funkcją encryptKey.
 */
export function decryptKey(encodedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');
  const decoded = Buffer.from(encodedText, 'base64').toString('utf8');
  const [ivHex, authTagHex, encryptedHex] = decoded.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
