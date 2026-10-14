import { describe, expect, it } from 'vitest'
import { formatMoney, minorDigits } from './money'

const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' })

describe('minorDigits', () => {
  it.each([
    ['USD', 2],
    ['EUR', 2],
    ['JPY', 0],
    ['KRW', 0],
    ['BHD', 3],
  ])('%s has %d minor digits', (currency, digits) => {
    expect(minorDigits(currency)).toBe(digits)
  })
})

describe('formatMoney', () => {
  it.each([
    [178048, '$1,780.48'],
    [0, '$0.00'],
    [1, '$0.01'],
    [9, '$0.09'],
    [10, '$0.10'],
    [100, '$1.00'],
    [3351240, '$33,512.40'],
    [-86242, '-$862.42'],
    [99999999999, '$999,999,999.99'],
  ])('%d minor units of USD is %s', (amountMinor, text) => {
    expect(formatMoney(usd(amountMinor))).toBe(text)
  })

  it('uses the currency\'s own minor unit: JPY has none, BHD has three', () => {
    expect(formatMoney({ amountMinor: 1500, currency: 'JPY' })).toBe('¥1,500')
    const plain = (text: string) => text.replace(/\s/g, ' ') // Intl puts a no-break space after the code
    expect(plain(formatMoney({ amountMinor: 1500, currency: 'BHD' }))).toBe('BHD 1.500')
    expect(plain(formatMoney({ amountMinor: 5, currency: 'BHD' }))).toBe('BHD 0.005')
  })

  it('keeps every digit of a large amount, with no float rounding', () => {
    expect(formatMoney(usd(1234567890123))).toBe('$12,345,678,901.23')
    expect(formatMoney(usd(Number.MAX_SAFE_INTEGER))).toBe('$90,071,992,547,409.91')
  })

  it('formats for another locale without changing the amount', () => {
    expect(formatMoney(usd(178048), 'de-DE').replace(/\s/g, ' ')).toBe('1.780,48 $')
  })
})
