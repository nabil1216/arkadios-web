import { afterEach, describe, expect, it, vi } from 'vitest'
import { filenameFromDisposition, saveBlob } from './download'

describe('filenameFromDisposition', () => {
  it.each([
    ['attachment; filename="invoice-2026-09-abc.html"', 'invoice-2026-09-abc.html'],
    ['attachment; filename=invoice.html', 'invoice.html'],
    ['attachment; filename=invoice.html; size=10', 'invoice.html'],
    ["attachment; filename*=UTF-8''invoice%202026.pdf", 'invoice 2026.pdf'],
    ['attachment; filename="old.pdf"; filename*=UTF-8\'\'new.pdf', 'new.pdf'],
    ['inline; FILENAME="a.txt"'.replace('FILENAME', 'filename'), 'a.txt'],
  ])('reads %j as %j', (header, name) => {
    expect(filenameFromDisposition(header)).toBe(name)
  })

  it.each([null, '', 'attachment', 'inline', 'attachment; filename=""'])('gives null for %j', (header) => {
    expect(filenameFromDisposition(header)).toBeNull()
  })

  it('never returns a path: folders are dropped', () => {
    expect(filenameFromDisposition('attachment; filename="../../etc/passwd"')).toBe('passwd')
    expect(filenameFromDisposition('attachment; filename="C:\\\\temp\\\\x.html"')).toBe('x.html')
    expect(filenameFromDisposition('attachment; filename="/abs/x.html"')).toBe('x.html')
  })

  it('drops control characters and leading dots', () => {
    expect(filenameFromDisposition('attachment; filename="a\u0001b.html"')).toBe('ab.html')
    expect(filenameFromDisposition('attachment; filename=".hidden"')).toBe('hidden')
    expect(filenameFromDisposition('attachment; filename="..."')).toBeNull()
  })

  it('survives a broken percent escape', () => {
    expect(filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A; filename=\"ok.html\"")).toBe('ok.html')
  })
})

describe('saveBlob', () => {
  afterEach(() => vi.restoreAllMocks())

  it('clicks a temporary link with the file name, then removes it and releases the address', () => {
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const clicked: Array<{ href: string; download: string }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.getAttribute('href') ?? '', download: this.download })
    })
    const blob = new Blob(['x'], { type: 'text/html' })

    saveBlob(blob, 'invoice-2026-09-abc.html')

    expect(create).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'invoice-2026-09-abc.html' }])
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
