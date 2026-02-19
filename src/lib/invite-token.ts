import crypto from 'crypto';

export const TOKEN_BYTES = 32;

/**
 * Generates a cryptographically secure random token.
 * Default length is 32 bytes (64 hex characters).
 */
export function generateToken(bytes: number = TOKEN_BYTES): string {
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token using SHA-256 for secure storage.
 * We never store the raw token in the database.
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validates if a token matches its hash.
 * This is effectively compare(hash(token), storedHash).
 */
export function validateToken(token: string, storedHash: string): boolean {
    const computedHash = hashToken(token);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}
