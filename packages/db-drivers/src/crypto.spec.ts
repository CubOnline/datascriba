import { describe, it, expect } from 'vitest'

import { decrypt, encrypt } from './crypto'
import { EncryptionError } from './errors'

const VALID_KEY = 'a'.repeat(64) // 32 bytes of 0xaa

describe('encrypt / decrypt', () => {
  it('round-trips a connection string', () => {
    const original = 'mssql://user:secret@localhost:1433/mydb'
    const ciphertext = encrypt(original, VALID_KEY)
    expect(decrypt(ciphertext, VALID_KEY)).toBe(original)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const input = 'same-input'
    const c1 = encrypt(input, VALID_KEY)
    const c2 = encrypt(input, VALID_KEY)
    expect(c1).not.toBe(c2)
  })

  it('throws EncryptionError with wrong key on decrypt', () => {
    const cipher = encrypt('secret', VALID_KEY)
    const wrongKey = 'b'.repeat(64)
    expect(() => decrypt(cipher, wrongKey)).toThrow(EncryptionError)
  })

  it('throws EncryptionError for invalid key length', () => {
    expect(() => encrypt('data', 'tooshort')).toThrow(EncryptionError)
  })

  it('throws EncryptionError for malformed ciphertext', () => {
    expect(() => decrypt('notvalid', VALID_KEY)).toThrow(EncryptionError)
  })
})
