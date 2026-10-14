import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/Switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TRIAL_DAYS_RANGE, type Plan, type PlanModule } from '../api/types'
import { trialError, type PlanDraft } from '../hooks/planDraft'

const tenants = (n: number) => `${n} ${n === 1 ? 'tenant' : 'tenants'}`
const COLUMN = 'h-auto w-[150px] border-b border-line bg-[#f8fafb] px-3.5 py-2.5 text-center align-middle font-semibold whitespace-normal'
const CELL = 'px-3.5 py-3 text-center align-middle'
const ROW_HEAD = 'px-3.5 py-3 text-left align-middle font-medium whitespace-normal'

interface PlansMatrixProps {
  /** Undefined while the plans are loading. */
  plans: Plan[] | undefined
  modules: PlanModule[]
  drafts: Record<string, PlanDraft>
  /** Without plans.manage every switch and the trial inputs are disabled. */
  readOnly: boolean
  onModule: (planId: string, moduleId: string, on: boolean) => void
  onTrialDays: (planId: string, text: string) => void
}

/** The demo's matrix: modules down the side, plans across the top, a switch in every cell. */
export function PlansMatrix({ plans, modules, drafts, readOnly, onModule, onTrialDays }: PlansMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-paper" aria-busy={!plans}>
      <Table className="text-[13.5px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="h-auto min-w-[260px] border-b border-line bg-[#f8fafb] px-3.5 py-2.5 font-semibold text-ink-2">
              Module
            </TableHead>
            {plans
              ? plans.map((plan) => (
                  <TableHead key={plan.id} scope="col" className={COLUMN}>
                    <span className="block text-[14.5px] text-ink">{plan.name}</span>
                    <span className="block text-[12.5px] font-normal text-ink-2">{tenants(plan.tenantCount)}</span>
                  </TableHead>
                ))
              : [0, 1, 2].map((i) => (
                  <TableHead key={i} scope="col" className={COLUMN}>
                    <Skeleton className="mx-auto h-4 w-20" />
                  </TableHead>
                ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!plans ? (
            Array.from({ length: 6 }, (_, row) => (
              <TableRow key={row} data-testid="plans-skeleton" className="hover:bg-transparent">
                <TableCell className={ROW_HEAD}>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                {[0, 1, 2].map((i) => (
                  <TableCell key={i} className={CELL}>
                    <Skeleton className="mx-auto h-[22px] w-[38px] rounded-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="row" className={ROW_HEAD}>
                  Trial length
                  <span className="block text-[12.5px] font-normal text-ink-2">Days before the first bill</span>
                </TableHead>
                {plans.map((plan) => {
                  const draft = drafts[plan.id]
                  const error = trialError(draft)
                  return (
                    <TableCell key={plan.id} className={CELL}>
                      <label htmlFor={`trial-${plan.id}`} className="sr-only">
                        Trial days for {plan.name}
                      </label>
                      <Input
                        id={`trial-${plan.id}`}
                        type="number"
                        min={TRIAL_DAYS_RANGE.min}
                        max={TRIAL_DAYS_RANGE.max}
                        value={draft.trialDays}
                        disabled={readOnly}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `trial-${plan.id}-err` : undefined}
                        onChange={(e) => onTrialDays(plan.id, e.target.value)}
                        className="mx-auto w-[90px] bg-paper text-center"
                      />
                      {error ? (
                        <p id={`trial-${plan.id}-err`} role="alert" className="mx-auto mt-1 max-w-[130px] text-[12.5px] text-red">
                          {error}
                        </p>
                      ) : null}
                    </TableCell>
                  )
                })}
              </TableRow>
              {modules.map((m) => (
                <TableRow key={m.id} className="hover:bg-transparent">
                  <TableHead scope="row" className={ROW_HEAD}>
                    {m.name}
                    <span className="block text-[12.5px] font-normal text-ink-2">{m.comingLater ? 'Coming later' : m.note}</span>
                  </TableHead>
                  {plans.map((plan) => (
                    <TableCell key={plan.id} className={CELL}>
                      <Switch
                        aria-label={`${m.name} on ${plan.name}`}
                        data-mod={m.id}
                        data-plan={plan.id}
                        checked={!!drafts[plan.id].modules[m.id]}
                        disabled={readOnly || m.comingLater}
                        onChange={(e) => onModule(plan.id, m.id, e.target.checked)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
