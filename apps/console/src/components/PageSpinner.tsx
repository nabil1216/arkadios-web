export function PageSpinner() {
  return (
    <div role="status" className="grid min-h-screen place-items-center">
      <div
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-line border-t-teal"
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}
