/**
 * Money on the wire: an integer in the currency's minor unit (cents for USD) and an ISO 4217 code.
 * Never a float. See "Money" in docs/ARCHITECTURE.md, Wire conventions.
 */
export interface Money {
  amountMinor: number
  currency: string
}

/** Decimal places of the currency's minor unit: 2 for USD, 0 for JPY, 3 for BHD. */
export function minorDigits(currency: string, locale = 'en-US'): number {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

/**
 * "$1,780.48" from { amountMinor: 178048, currency: 'USD' }. The amount is split into whole and minor
 * parts with integer arithmetic and handed to Intl as a decimal string, so nothing is divided as a float.
 */
export function formatMoney({ amountMinor, currency }: Money, locale = 'en-US'): string {
  const digits = minorDigits(currency, locale)
  const sign = amountMinor < 0 ? '-' : ''
  const abs = Math.abs(amountMinor)
  const unit = 10 ** digits
  const whole = Math.floor(abs / unit)
  const minor = String(abs % unit).padStart(digits, '0')
  const decimal = digits > 0 ? `${sign}${whole}.${minor}` : `${sign}${whole}`
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(decimal as `${number}`)
}
