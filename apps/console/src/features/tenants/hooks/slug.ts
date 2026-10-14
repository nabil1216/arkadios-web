/** A company name as a domain, as the demo's slug() does: "Marlow & Finch" becomes "marlow-and-finch". */
export function slugify(name: string, maxLength = 30): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '')
}
