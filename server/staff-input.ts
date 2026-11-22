import { z } from "zod";
const date = z.string().date();
const period = date.refine((d) => d.endsWith("-01"));
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const amount = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const reason = z.string().trim().min(2).max(500);
const edit = { id: z.string().uuid(), version: z.number().int().positive() };
const pause = z.number().int().min(0).max(1439);
const span = { start: local, end: local, pause };
export const operations = {
  contract: z.object({
    date,
    mode: z.enum(["day", "month", "hour"]),
    rate: amount,
    hours: z.coerce.number().positive().max(168),
    employment: reason,
    rest: z.coerce.number().min(0).max(168),
    weeklyRest: z.coerce.number().min(0).max(168),
  }),
  cancel: z.object({ ...edit, reason }),
  shift: z.union([
    z.object({ ...span, ...edit, reason }).strict(),
    z.object({ ...span, repeat: z.number().int().min(1).max(52) }).strict(),
  ]),
  time: z.union([
    z.object({ ...span, ...edit, reason, confirmed: z.boolean() }).strict(),
    z.object({ ...span, reason, confirmed: z.boolean() }).strict(),
  ]),
  start: z.object({}).strict(),
  finish: z.object({ ...edit, pause, reason }),
  leave: z.object({
    date,
    until: date,
    kind: z.enum(["paid", "unpaid", "sick", "other", "rest"]),
  }),
  decision: z.object({ id: edit.id, status: z.enum(["approved", "declined"]) }),
  bonusRequest: z.object({
    period,
    date,
    amount: amount.refine((v) => Number(v) > 0),
    reason,
  }),
  bonusDecision: z.object({
    id: edit.id,
    status: z.enum(["approved", "declined"]),
  }),
  money: z.object({
    period,
    date,
    kind: z.enum([
      "bonus",
      "deduction",
      "overtime",
      "night",
      "holiday",
      "advance",
      "payment",
    ]),
    amount: amount.refine((v) => Number(v) > 0),
    reason,
    method: z.enum(["cash", "bank"]).optional(),
  }),
  close: z.object({ period, net: amount, reason }),
};
export const envelope = z.object({
  employee: z.string().uuid(),
  request: z.string().uuid(),
  action: z.enum(
    Object.keys(operations) as [
      keyof typeof operations,
      ...(keyof typeof operations)[],
    ],
  ),
  data: z.record(z.unknown()),
});
