import { z } from 'zod'
import { DURATIONS, REASON_RANGE } from '../api/types'

/** Shown next to the reason: the client's admins read it, so it is not a place for secrets or personal data. */
export const REASON_NOTICE = "Do not type passwords or client personal data. The client's admins will see this reason."

// Control characters other than a tab and a line break. The server checks the same rules again and has the last word.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/

// Messages follow the demo's. The reason is plain text: it is trimmed, counted after trimming, and never rendered as markup.
export const startSchema = z.object({
  tenantId: z.string().min(1, 'Choose a tenant.'),
  tenantUserId: z.string().min(1, 'Choose a user.'),
  reason: z
    .string()
    .trim()
    .min(REASON_RANGE.min, `Describe why you need access, in at least ${REASON_RANGE.min} characters.`)
    .max(REASON_RANGE.max, `Use ${REASON_RANGE.max} characters or fewer.`)
    .refine((text) => !CONTROL_CHARS.test(text), 'Use plain text only.'),
  durationMinutes: z.union([z.literal(DURATIONS[0]), z.literal(DURATIONS[1]), z.literal(DURATIONS[2])]),
  mode: z.enum(['read', 'edit']),
})
export type StartValues = z.infer<typeof startSchema>
