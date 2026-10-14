import { describe, expect, it } from 'vitest'
import { queryTenants, tenantRecords } from './tenants'

function list(params: Record<string, string> = {}) {
  const result = queryTenants(new URLSearchParams(params))
  if (!result.ok) throw new Error('unexpected errors: ' + JSON.stringify(result.errors))
  return result.body
}
const errorsFor = (params: Record<string, string>) => {
  const result = queryTenants(new URLSearchParams(params))
  if (result.ok) throw new Error('expected errors')
  return result.errors
}
const names = (params: Record<string, string> = {}) => list(params).items.map((t) => t.name)

describe('seed', () => {
  it('is the six demo tenants with opaque GUID ids', () => {
    expect(tenantRecords).toHaveLength(6)
    const ids = tenantRecords.map((t) => t.id)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(id).not.toMatch(/^\d+$/)
    }
    expect(new Set(ids).size).toBe(6)
  })
})

describe('envelope and defaults', () => {
  it('returns items, total, page and pageSize', () => {
    const body = list()
    expect(body).toMatchObject({ total: 6, page: 1, pageSize: 25 })
    expect(body.items).toHaveLength(6)
  })

  it('sorts by name ascending by default', () => {
    expect(names()).toEqual([
      'Arkadios Home Office',
      'Cobalt Ridge Wealth',
      'Marlow & Finch Partners',
      'Northwind Advisory Group',
      'Quillon Trust Company',
      'Sterling Hollow Family Office',
    ])
  })

  it('gives each item exactly the documented fields', () => {
    const item = list().items[0]
    expect(Object.keys(item).sort()).toEqual(
      ['createdAt', 'database', 'domain', 'id', 'name', 'planId', 'planName', 'status', 'userLimit', 'usersUsed'].sort(),
    )
    expect(item).toMatchObject({
      name: 'Arkadios Home Office',
      domain: 'arkadios.platform.example',
      database: 'tenant_arkadios',
      planId: 'professional',
      planName: 'Professional',
      usersUsed: 64,
      userLimit: 100,
      status: 'active',
    })
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false)
  })

  it('never includes a connection string or anything but the database name', () => {
    const json = JSON.stringify(list())
    expect(json).not.toMatch(/Server=|Password|connection/i)
    expect(tenantRecords[0].connectionString).toContain('Password=') // it exists on the server side
  })
})

describe('q', () => {
  it('matches name, domain and database, ignoring case and outer spaces', () => {
    expect(names({ q: 'north' })).toEqual(['Northwind Advisory Group'])
    expect(names({ q: '  NORTH  ' })).toEqual(['Northwind Advisory Group'])
    expect(names({ q: 'cobalt-ridge.platform' })).toEqual(['Cobalt Ridge Wealth'])
    expect(names({ q: 'tenant_marlow_finch' })).toEqual(['Marlow & Finch Partners'])
  })

  it('counts the matches in total', () => {
    expect(list({ q: 'zzz' })).toMatchObject({ items: [], total: 0 })
    expect(list({ q: 'a', pageSize: '2' }).total).toBeGreaterThan(2)
  })

  it('treats % and _ as plain characters, not wildcards', () => {
    expect(list({ q: '%' }).total).toBe(0)
    expect(list({ q: 'a%' }).total).toBe(0)
    expect(list({ q: 'n_n' }).total).toBe(0) // as a wildcard this would match "nan" in "tenant"
    expect(list({ q: 'tenant_a' }).total).toBe(1) // a literal underscore still matches
  })

  it('rejects a search longer than 100 characters', () => {
    expect(errorsFor({ q: 'x'.repeat(101) }).q).toBeDefined()
    expect(list({ q: 'x'.repeat(100) }).total).toBe(0)
  })
})

describe('status', () => {
  it('filters by status', () => {
    expect(names({ status: 'suspended' })).toEqual(['Sterling Hollow Family Office'])
    expect(names({ status: 'trial' })).toEqual(['Marlow & Finch Partners'])
    expect(list({ status: 'active' }).total).toBe(4)
    expect(list({ status: 'offboarding' })).toMatchObject({ items: [], total: 0 })
  })

  it('combines with q', () => {
    expect(names({ status: 'active', q: 'o' })).toEqual([
      'Arkadios Home Office',
      'Cobalt Ridge Wealth',
      'Northwind Advisory Group',
      'Quillon Trust Company',
    ])
    expect(list({ status: 'suspended', q: 'north' }).total).toBe(0)
  })

  it('treats an empty status as no filter', () => {
    expect(list({ status: '' }).total).toBe(6)
  })

  it('rejects a status that is not on the list, including "all"', () => {
    expect(errorsFor({ status: 'all' }).status).toBeDefined()
    expect(errorsFor({ status: 'deleted' }).status).toBeDefined()
  })
})

describe('sort', () => {
  it('sorts descending with a leading -', () => {
    expect(names({ sort: '-name' }).at(0)).toBe('Sterling Hollow Family Office')
    expect(names({ sort: '-name' }).at(-1)).toBe('Arkadios Home Office')
  })

  it('sorts by usersUsed, status, createdAt and plan', () => {
    expect(list({ sort: 'usersUsed' }).items.map((t) => t.usersUsed)).toEqual([18, 31, 47, 64, 140, 212])
    expect(list({ sort: '-usersUsed' }).items.map((t) => t.usersUsed)).toEqual([212, 140, 64, 47, 31, 18])
    expect(list({ sort: 'status' }).items.map((t) => t.status)).toEqual(['active', 'active', 'active', 'active', 'suspended', 'trial'])
    expect(names({ sort: 'createdAt' }).at(0)).toBe('Sterling Hollow Family Office') // oldest
    expect(names({ sort: '-createdAt' }).at(0)).toBe('Marlow & Finch Partners') // newest
    expect(list({ sort: 'plan' }).items.map((t) => t.planName)).toEqual([
      'Enterprise', 'Enterprise', 'Essentials', 'Professional', 'Professional', 'Professional',
    ])
  })

  it('breaks ties by name ascending, whatever the direction', () => {
    const asc = list({ sort: 'status' }).items.slice(0, 4).map((t) => t.name)
    const desc = list({ sort: '-status' }).items.slice(-4).map((t) => t.name)
    expect(asc).toEqual(['Arkadios Home Office', 'Cobalt Ridge Wealth', 'Northwind Advisory Group', 'Quillon Trust Company'])
    expect(desc).toEqual(asc)
  })

  it('accepts only whitelisted keys', () => {
    for (const sort of ['id', '-id', 'database', 'connectionString', 'name;drop table', 'name desc', '--name', 'NAME', '-']) {
      expect(errorsFor({ sort }).sort, sort).toBeDefined()
    }
  })
})

describe('paging', () => {
  it('returns the requested page and the full total', () => {
    const first = list({ pageSize: '4' })
    expect(first).toMatchObject({ page: 1, pageSize: 4, total: 6 })
    expect(first.items).toHaveLength(4)
    const second = list({ pageSize: '4', page: '2' })
    expect(second).toMatchObject({ page: 2, total: 6 })
    expect(second.items.map((t) => t.name)).toEqual(['Quillon Trust Company', 'Sterling Hollow Family Office'])
  })

  it('returns no items, with the real total, for a page past the end', () => {
    expect(list({ pageSize: '4', page: '9' })).toMatchObject({ items: [], total: 6, page: 9 })
  })

  it('does not repeat or skip rows across pages', () => {
    const all = [1, 2, 3].flatMap((page) => names({ pageSize: '2', page: String(page), sort: '-usersUsed' }))
    expect(all).toEqual(names({ sort: '-usersUsed' }))
  })

  it('accepts a page size of 1 and 100, and rejects 0, 101 and junk', () => {
    expect(list({ pageSize: '1' }).items).toHaveLength(1)
    expect(list({ pageSize: '100' }).pageSize).toBe(100)
    for (const pageSize of ['0', '101', '-1', '2.5', 'abc', '']) {
      expect(errorsFor({ pageSize }).pageSize, pageSize).toBeDefined()
    }
  })

  it('rejects a page below 1 or not a whole number', () => {
    for (const page of ['0', '-1', '1.5', 'abc', '']) expect(errorsFor({ page }).page, page).toBeDefined()
  })

  it('reports every bad parameter at once', () => {
    expect(Object.keys(errorsFor({ status: 'x', sort: 'y', page: '0', pageSize: '0' })).sort()).toEqual(['page', 'pageSize', 'sort', 'status'])
  })
})
