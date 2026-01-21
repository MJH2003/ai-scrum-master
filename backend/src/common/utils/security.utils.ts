import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Security utilities for data protection
 */
export class SecurityUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;

  /**
   * Hash a value using SHA-256 (one-way)
   */
  static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate a cryptographically secure random token
   */
  static generateToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure API key
   */
  static generateApiKey(): string {
    const prefix = 'asm'; // AI Scrum Master
    const timestamp = Date.now().toString(36);
    const random = randomBytes(16).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(plaintext: string, key: string): string {
    const keyBuffer = this.deriveKey(key);
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv(this.ALGORITHM, keyBuffer, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(ciphertext: string, key: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid ciphertext format');
    }

    const keyBuffer = this.deriveKey(key);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Mask sensitive data for logging (e.g., email, API keys)
   */
  static mask(value: string, visibleChars = 4): string {
    if (value.length <= visibleChars * 2) {
      return '*'.repeat(value.length);
    }
    const start = value.slice(0, visibleChars);
    const end = value.slice(-visibleChars);
    const masked = '*'.repeat(Math.max(value.length - visibleChars * 2, 3));
    return `${start}${masked}${end}`;
  }

  /**
   * Sanitize a string to prevent XSS attacks
   */
  static sanitizeHtml(input: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
  }

  /**
   * Validate and sanitize a URL
   */
  static sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  /**
   * Derive a 256-bit key from a password
   */
  private static deriveKey(key: string): Buffer {
    return createHash('sha256').update(key).digest();
  }

  /**
   * Compare two strings in constant time to prevent timing attacks
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
