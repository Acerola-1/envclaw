/**
 * 代理调用 V5 后端 /product/datacenter/api2/v5/system/region/tree 获取城市级联树
 * V5 使用 AES-128-CBC 加密请求体和响应体，multipart/form-data 传输
 */

import CryptoJS from 'crypto-js'

const V5_BASE_URL = 'https://www.mapairs.com'
const V5_REGION_TREE_PATH = '/product/datacenter/api2/v5/system/region/tree'
const V5_AES_KEY = 'hnm19epgQmnSvq8qSfbbC2F0bi4lZdj1'
const V5_CRYPTO_KEY = 'jAupT24Oe2tG2rKxqw5GlEfElFjRQsGa'  // 与 V5 前端 crypto.ts cryptoKey 一致

/** AES-128-CBC 加密（与 V5 前端 crypto.ts 实现一致） */
function encryptAES(data: string, key: string): string {
  const dataBytes = CryptoJS.enc.Utf8.parse(data)
  const keyBytes = CryptoJS.enc.Utf8.parse(key)
  const encrypted = CryptoJS.AES.encrypt(dataBytes, keyBytes, {
    iv: keyBytes,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return CryptoJS.enc.Base64.stringify(encrypted.ciphertext)
}

/**
 * V5 前端 crypto.encryptAES(token, cryptoKey) — 用于 Blade-Auth 请求头
 * 加密 V5 access_token 以构造 Blade-Auth 头
 */
function encryptAESHeader(data: string, key: string): string {
  const dataBytes = CryptoJS.enc.Utf8.parse(data)
  const keyBytes = CryptoJS.enc.Utf8.parse(key)
  const encrypted = CryptoJS.AES.encrypt(dataBytes, keyBytes, {
    iv: keyBytes,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return CryptoJS.enc.Base64.stringify(encrypted.ciphertext)
}

/** AES-128-CBC 解密（与 V5 前端 crypto.ts 实现一致） */
function decryptAES(data: string, key: string): string {
  const keyBytes = CryptoJS.enc.Utf8.parse(key)
  const decrypted = CryptoJS.AES.decrypt(data, keyBytes, {
    iv: keyBytes,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  return CryptoJS.enc.Utf8.stringify(decrypted)
}

/** 将 AES 加密后的参数构造为 multipart/form-data body（含 boundary） */
function buildMultipartBody(encryptedData: string): { body: Blob; boundary: string } {
  const boundary = '----WebKitFormBoundary'
  const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n`
  const closing = `\r\n--${boundary}--`
  const raw = Buffer.from(preamble + encryptedData + closing, 'utf8')
  const blob = new Blob([raw], { type: 'application/octet-stream' })
  return { body: blob, boundary }
}

/**
 * 调用 V5 region/tree 接口获取城市级联树
 * @param radio 'no' = 包含全部城市, 'yes' = 不含全部
 * @param v5Token V5 access_token（来自用户登录），用于请求认证
 * @returns V5 返回的 city tree 数组（解密后）
 */
export async function fetchFromV5RegionTree(radio: string, v5Token?: string): Promise<unknown[]> {
  const url = `${V5_BASE_URL}${V5_REGION_TREE_PATH}`

  // 1. 构造并加密请求参数
  const params = JSON.stringify({ radio })
  const encrypted = encryptAES(params, V5_AES_KEY)

  // 2. 发送 multipart/form-data 请求
  const { body, boundary } = buildMultipartBody(encrypted)
  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Blade-Requested-With': 'BladeHttpRequest',
    'Connection': 'close',
  }
  if (v5Token) {
    // V5 前端构造 Blade-Auth 头: "crypto <AES加密的token>"
    const encryptedToken = encryptAESHeader(v5Token, V5_CRYPTO_KEY)
    headers['Blade-Auth'] = `crypto ${encryptedToken}`
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`V5 region/tree HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  // 3. 解密响应体
  const text = await res.text()

  // V5 响应格式有两种：
  // A) {"data": "AES_ENCRYPTED_BASE64"} — 外层 JSON 包装
  // B) "AES_ENCRYPTED_BASE64" — 裸加密数据（V5 响应体本身被加密）
  let decryptedData: string

  // 尝试路径 A：解析外层 JSON
  try {
    const responseJson = JSON.parse(text)
    const encryptedResponse = responseJson.data
    if (encryptedResponse) {
      decryptedData = decryptAES(encryptedResponse, V5_AES_KEY)
    } else {
      throw new Error(`V5 响应缺少 data 字段`)
    }
  } catch (e: any) {
    // 路径 B：裸加密数据，直接解密
    if (text.trim().length > 0) {
      decryptedData = decryptAES(text.trim(), V5_AES_KEY)
    } else {
      throw new Error(`V5 响应为空`)
    }
  }

  const parsed = JSON.parse(decryptedData)

  // V5 返回格式: [ ... ]  或  { data: [...], ... }
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed.data)) return parsed.data
  throw new Error(`V5 响应解析失败，非预期格式: ${decryptedData.slice(0, 200)}`)
}
