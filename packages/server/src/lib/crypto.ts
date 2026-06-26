import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/** 从环境变量或固定种子派生加密密钥。生产环境应使用环境变量。 */
function getEncryptionKey(): Buffer {
  const seed = process.env.ENVCLAW_ENCRYPTION_KEY || 'envclaw-default-encryption-key-change-in-prod'
  const salt = 'envclaw-platform-credentials-salt'
  return scryptSync(seed, salt, 32)
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // 格式: iv:authTag:ciphertext (base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const [ivB64, authTagB64, dataB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Invalid encrypted format')
  }
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  return decipher.update(data) + decipher.final('utf8')
}

/** 返回掩码,如 "••••••••" */
export function mask(_value: string): string {
  return '••••••••'
}
