/**
 * The file name from a Content-Disposition header, or null. Handles filename="x" and filename*=UTF-8''x.
 * Whatever the server sends, the result is a bare name: no folders, no control characters.
 */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  let raw: string | undefined
  if (star) {
    try {
      raw = decodeURIComponent(star[1].trim())
    } catch {
      raw = undefined
    }
  }
  raw ??= /filename\s*=\s*"([^"]*)"/.exec(header)?.[1] ?? /filename\s*=\s*([^;\s]+)/.exec(header)?.[1]
  if (!raw) return null
  const last = raw.split(/[\\/]/).pop()!
  const printable = [...last].filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f).join('')
  return printable.trim().replace(/^\.+/, '') || null
}

/** Saves a blob as a file through a temporary link. The address is released straight away. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
