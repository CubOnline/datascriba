import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { EncryptionError } from './errors'

const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: `iv_hex:authTag_hex:ciphertext_hex` (all hex-encoded).
 *
 * @param plaintext - The connection string (or any secret) to encrypt
 * @param masterKeyHex - 64-character hex string representing a 32-byte key
 */
export function encrypt(plaintext: string, masterKeyHex: string): string {
  try {
    const key = Buffer.from(masterKeyHex, 'hex')
    if (key.length !== 32) {
      throw new EncryptionError('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)')
    }
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
  } catch (error) {
    if (error instanceof EncryptionError) throw error
    throw new EncryptionError('Encryption failed', error)
  }
}

/**
 * Decrypts a ciphertext string produced by `encrypt`.
 *
 * @param ciphertext - The `iv_hex:authTag_hex:ciphertext_hex` string
 * @param masterKeyHex - 64-character hex string representing a 32-byte key
 */
export function decrypt(ciphertext: string, masterKeyHex: string): string {
  try {
    const key = Buffer.from(masterKeyHex, 'hex')
    if (key.length !== 32) {
      throw new EncryptionError('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)')
    }
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new EncryptionError('Invalid ciphertext format — expected iv:authTag:data')
    }
    const [ivHex, authTagHex, dataHex] = parts as [string, string, string]
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return decipher.update(data).toString('utf8') + decipher.final('utf8')
  } catch (error) {
    if (error instanceof EncryptionError) throw error
    throw new EncryptionError('Decryption failed — key may be wrong or data corrupted', error)
  }
}
