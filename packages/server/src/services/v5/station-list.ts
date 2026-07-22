/**
 * 代理调用 V5 后端 /product/datacenter/api2/v5/air/statistics/station/list 获取站点列表
 * V5 使用 AES-128-CBC 加密请求体，multipart/form-data 传输
 */

import CryptoJS from 'crypto-js'

const V5_BASE_URL = 'https://www.mapairs.com'
const V5_STATION_LIST_PATH = '/product/datacenter/api2/v5/air/statistics/station/list'
const V5_AES_KEY = 'hnm19epgQmnSvq8qSfbbC2F0bi4lZdj1'
const V5_CRYPTO_KEY = 'jAupT24Oe2tG2rKxqw5GlEfElFjRQsGa'

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
 * 调用 V5 station/list 接口获取站点列表
 * @param province 省份编码（provinceCodeVO）
 * @param region 区域编码（regionKeyVO，可多选逗号分隔）
 * @param stationType 站点类型（逗号分隔，如 "S-100,S-16"）
 * @param v5Token V5 access_token
 * @returns 站点列表数组（解密后）
 */
export async function fetchV5StationList(
  province: string,
  region: string,
  stationType: string,
  v5Token?: string,
): Promise<unknown[]> {
  const url = `${V5_BASE_URL}${V5_STATION_LIST_PATH}`

  // 1. 构造并加密请求参数
  const params = JSON.stringify({ province, region, stationType })
  const encrypted = encryptAES(params, V5_AES_KEY)

  // 2. 发送 multipart/form-data 请求
  const { body, boundary } = buildMultipartBody(encrypted)
  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Blade-Requested-With': 'BladeHttpRequest',
    'Connection': 'close',
  }
  if (v5Token) {
    const encryptedToken = encryptAES(v5Token, V5_CRYPTO_KEY)
    headers['Blade-Auth'] = `crypto ${encryptedToken}`
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`V5 station/list HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  // 3. 解密响应体
  const text = await res.text()

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

  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed.data)) return parsed.data
  throw new Error(`V5 响应解析失败，非预期格式: ${decryptedData.slice(0, 200)}`)
}
