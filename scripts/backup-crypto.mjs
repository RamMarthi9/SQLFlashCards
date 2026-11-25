import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { link, open, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

const magic = Buffer.from('SQLFCB01')
const headerLength = magic.length + 12
const tagLength = 16

export function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  const encoded = value?.trim()
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('BACKUP_ENCRYPTION_KEY must encode exactly 32 random bytes in base64.')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('BACKUP_ENCRYPTION_KEY must encode exactly 32 random bytes in base64.')
  return key
}

export async function encryptBackup(source, destination, key) {
  const observeEarlyError = () => {}
  source.on('error', observeEarlyError)
  const nonce = randomBytes(12)
  const header = Buffer.concat([magic, nonce])
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(header)
  const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 })
  let created = false
  try {
    await once(output, 'open')
    created = true
    output.write(header)
    await pipeline(source, cipher, output, { end: false })
    output.end(cipher.getAuthTag())
    await finished(output)
  } catch (error) {
    source.destroy()
    output.destroy()
    await finished(output).catch(() => {})
    if (created) await rm(destination, { force: true })
    throw error
  } finally {
    source.off('error', observeEarlyError)
  }
}

export async function decryptBackup(source, destination, key) {
  const input = await open(source, 'r')
  const temporary = join(dirname(destination), `.${basename(destination)}.${randomBytes(12).toString('hex')}.partial`)
  try {
    const { size } = await input.stat()
    if (size < headerLength + tagLength) throw new Error('Invalid or truncated backup.')
    const header = Buffer.alloc(headerLength)
    await input.read(header, 0, headerLength, 0)
    if (!header.subarray(0, magic.length).equals(magic)) throw new Error('Unsupported backup format.')
    const tag = Buffer.alloc(tagLength)
    await input.read(tag, 0, tagLength, size - tagLength)
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length))
    decipher.setAAD(header)
    decipher.setAuthTag(tag)
    const ciphertext = size === headerLength + tagLength
      ? Readable.from([])
      : createReadStream(source, { start: headerLength, end: size - tagLength - 1 })
    await pipeline(ciphertext, decipher, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
    // Publish plaintext only after authentication succeeds. Hard-link creation also refuses overwrites.
    await link(temporary, destination)
  } finally {
    await input.close()
    await rm(temporary, { force: true })
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [mode, source, destination, extra] = process.argv.slice(2)
    if (!['encrypt', 'decrypt'].includes(mode) || !source || !destination || extra) throw new Error('Usage: node scripts/backup-crypto.mjs encrypt|decrypt <input-file> <new-output-file>')
    const key = backupKey()
    if (mode === 'encrypt') await encryptBackup(createReadStream(source), destination, key)
    else await decryptBackup(source, destination, key)
    console.log(mode === 'encrypt' ? 'Backup encrypted.' : 'Backup authenticated and decrypted.')
  } catch {
    console.error('Backup encryption/decryption failed. Check the key, input, and new output path; no existing file was overwritten.')
    process.exitCode = 1
  }
}
