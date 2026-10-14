/** List response from every list endpoint (docs/ARCHITECTURE.md, Wire conventions). */
export interface ListResponse<T> {
  items: T[]
  /** Count after filtering, before paging. */
  total: number
  page: number
  pageSize: number
}

export const LIST_DEFAULTS = {
  page: 1,
  pageSize: 25,
  maxPageSize: 100,
  /** Longest accepted `q`. */
  maxQueryLength: 100,
} as const
