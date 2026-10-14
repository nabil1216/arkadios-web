/**
 * Money on the wire: an integer in the currency's minor unit (cents for USD) and an ISO 4217 code.
 * Never a float. See "Money" in docs/ARCHITECTURE.md, Wire conventions.
 */
export interface Money {
  amountMinor: number
  currency: string
}
