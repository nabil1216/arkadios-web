import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchTenantOptions, tenantOptionsKey, tenantsKey } from '../api/tenants'
import { CreateTenantForm } from './CreateTenantForm'
import { ProvisioningView } from './ProvisioningView'

interface CreateTenantDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The drawer is opened from state, not from a trigger, so it needs to be told where focus goes back to. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/** Create tenant: the form, then the provisioning steps, then the ready note (the demo's drawer). */
export function CreateTenantDrawer({ open, onOpenChange, returnFocusTo }: CreateTenantDrawerProps) {
  const queryClient = useQueryClient()
  const [provisioningId, setProvisioningId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const options = useQuery({
    queryKey: tenantOptionsKey,
    queryFn: fetchTenantOptions,
    enabled: open,
    // Plans and regions rarely change.
    staleTime: 5 * 60_000,
  })

  function change(next: boolean) {
    // While the server is setting the tenant up the drawer stays open, as in the demo.
    if (!next && busy) return
    if (!next) setProvisioningId(null)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent
        showCloseButton={!busy}
        className="w-[min(500px,100vw)] gap-0 overflow-y-auto bg-paper sm:max-w-none"
        aria-busy={busy}
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return
          event.preventDefault()
          returnFocusTo.current.focus()
        }}
      >
        <SheetHeader className="px-5 pt-[18px] pb-3">
          <SheetTitle className="font-display text-[22px] font-medium">Create tenant</SheetTitle>
          <SheetDescription>Each tenant gets its own domain and its own database.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-5 pt-2 pb-5">
          {provisioningId ? (
            <ProvisioningView id={provisioningId} onDone={() => change(false)} onBusyChange={setBusy} />
          ) : options.isError ? (
            <div role="alert" className="grid gap-3">
              <p>Could not load the plans and regions.</p>
              <div>
                <Button variant="secondary" onClick={() => void options.refetch()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : options.data ? (
            <CreateTenantForm
              options={options.data}
              onCancel={() => change(false)}
              onAccepted={({ id }) => {
                // A tenant is on its way: any list on screen is about to be out of date.
                void queryClient.invalidateQueries({ queryKey: tenantsKey })
                setProvisioningId(id)
              }}
            />
          ) : (
            <div role="status" aria-label="Loading the form" className="grid gap-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[38px] w-full" />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
