import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.DATABASE_PASSWORD || 'default-dev-key-32chars-long!!';
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return plaintext;
  }
}

export function decryptToken(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  if (!ciphertext.startsWith('enc:')) {
    return ciphertext;
  }
  
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      console.warn('Invalid encrypted token format');
      return ciphertext;
    }
    
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext;
  }
}

export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:');
}
