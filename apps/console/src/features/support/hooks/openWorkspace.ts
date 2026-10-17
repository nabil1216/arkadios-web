/**
 * Opens the tenant workspace in a new tab at the handoff address. The one-time code is in the URL fragment, so it is not
 * sent to any server; `noopener` and `noreferrer` keep the new tab from reaching this one or learning where it came from.
 */
export function openWorkspace(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
