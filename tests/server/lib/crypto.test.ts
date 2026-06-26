import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, mask } from '../../../packages/server/src/lib/crypto'

describe('crypto utils', () => {
  it('encrypt then decrypt returns original', () => {
    const original = 'my-secret-password'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(decrypt(encrypted)).toBe(original)
  })

  it('encrypted output contains colons (iv:tag:data)', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
  })

  it('decrypt throws on invalid format', () => {
    expect(() => decrypt('invalid')).toThrow()
  })

  it('mask returns fixed string', () => {
    expect(mask('anything')).toBe('••••••••')
    expect(mask('')).toBe('••••••••')
  })

  it('different inputs produce different ciphertexts', () => {
    const a = encrypt('password-a')
    const b = encrypt('password-b')
    expect(a).not.toBe(b)
  })
})
