import { createHash, createHmac, scrypt } from 'node:crypto'
import { ApiError } from './accountTypes.js'

export const quarterHour = 15 * 60_000
export const sessionDuration = 30 * 24 * 60 * 60_000
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const pepperMarker = (pepper: string) => createHmac('sha256', pepper).update('sqlflashcards-pin-pepper-v1').digest('hex')

export class PinHasher {
  private activeHashes = 0
  constructor(private readonly pepper: string) {
    if (pepper.length < 32) throw new Error('The PIN pepper must contain at least 32 characters.')
  }

  async derive(pin: string, salt: string): Promise<Buffer> {
    if (this.activeHashes >= 2) throw new ApiError(429, 'rate_limited', 'Sign-in is busy. Please try again shortly.', 5)
    this.activeHashes++
    try {
      const input = createHmac('sha256', this.pepper).update(pin).digest()
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(input, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
      })
    } finally { this.activeHashes-- }
  }
}
