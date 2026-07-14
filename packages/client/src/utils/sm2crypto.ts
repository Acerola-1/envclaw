import { sm2 } from 'sm-crypto'

/**
 * SM2 加密工具（用于 Mapairs 平台登录密码加密）
 * 公钥与 Mapairs 平台配对使用
 */
export default class SM2Crypto {
  // Mapairs 平台配对公钥（用于加密，前端安全）
  static publicKey =
    '04dc91c988f238c0b1ec80813654fc76abe3bccd6e054d2f99b3a3af6826b418574fb20a44097a745a80c6d60de5392a055e16d53e4b9297c6a86a247b3c47fcf0'

  /**
   * SM2 加密
   * @param data 明文密码
   * @returns hex 格式密文
   */
  static encrypt(data: string): string {
    try {
      return sm2.doEncrypt(data, this.publicKey, 0) as string
    } catch (error: any) {
      console.error('[SM2Crypto] encrypt failed:', error)
      return ''
    }
  }
}

// 便捷导出
export const sm2Encrypt = SM2Crypto.encrypt.bind(SM2Crypto)
