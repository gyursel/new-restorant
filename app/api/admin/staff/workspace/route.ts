import { z } from "zod";
import { staffIdentity } from "../../../../../server/auth";
import {
  db,
  json,
  failure,
  HttpError,
  sameOrigin,
} from "../../../../../server/cms";
import { envelope, operations } from "../../../../../server/staff-input";
export const dynamic = "force-dynamic";

function handle(err: unknown) {
  const e = err as { code?: string; message?: string };
  if (e.code === "P0001")
    return failure(new HttpError(409, e.message || "Конфликт."));
  if (e.code === "P0002")
    return failure(new HttpError(409, "Записът е променен. Обнови данните."));
  if (e.code?.startsWith("23") || e.code?.startsWith("22"))
    return failure(new HttpError(400, "Провери датите, сумите и почивката."));
  if (e.code === "42P01" || e.code === "42883")
    return failure(
      new HttpError(
        503,
        "Приложи миграциите за персонал в базата за тази среда.",
      ),
    );
  return failure(err);
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await staffIdentity();
    const raw = await req.text();
    if (raw.length > 6000) throw new HttpError(413, "Твърде голяма заявка.");
    const body = JSON.parse(raw);
    if (body.action === "budget" || body.action === "payDate") {
      if (!user.owner) throw new HttpError(403, "Необходим е собственик.");
      const period = z
        .string()
        .date()
        .refine((v) => v.endsWith("-01"))
        .parse(body.period);
      const sql = db();
      if (body.action === "budget") {
        const amount = z
          .string()
          .regex(/^\d{1,9}(\.\d{1,2})?$/)
          .parse(body.amount);
        await sql`INSERT INTO staff_month_budgets VALUES(${period},${amount},${user.email})
          ON CONFLICT(period) DO UPDATE SET amount=excluded.amount,actor=excluded.actor`;
      } else {
        const employee = z.string().uuid().parse(body.employee),
          due = z.string().date().parse(body.due);
        await sql`INSERT INTO staff_pay_dates VALUES(${employee},${period},${due},${user.email})
          ON CONFLICT(employee_id,period) DO UPDATE SET due=excluded.due,actor=excluded.actor`;
      }
      return json({ ok: true });
    }
    if (body.action === "copyWeek") {
      const copy = z
        .object({ date: z.string().date(), request: z.string().uuid() })
        .parse(body);
      await db()`SELECT staff_copy_week(${copy.date}::date,${copy.request}::uuid,${user.email})`;
      return json({ ok: true });
    }
    const input = envelope.parse(body);
    if (
      !user.owner &&
      ["contract", "money", "close", "bonusRequest", "bonusDecision"].includes(
        input.action,
      )
    )
      throw new HttpError(403, "Необходим е собственик.");
    const data = operations[input.action].parse(input.data);
    const sql = db();
    await sql`SELECT staff_record(${input.employee}::uuid,${input.request}::uuid,${input.action},${JSON.stringify(data)}::jsonb,${user.email})`;
    return json({ ok: true });
  } catch (e) {
    return e instanceof SyntaxError
      ? failure(new HttpError(400, "Невалидна заявка."))
      : handle(e);
  }
}

export async function GET(req: Request) {
  try {
    const user = await staffIdentity();
    const params = new URL(req.url).searchParams;
    const month = z
      .string()
      .date()
      .refine((v) => v.endsWith("-01"))
      .parse(params.get("period"));
    const emp = z.string().uuid().nullable().parse(params.get("employee"));
    const sql = db();
    if (params.get("view") === "trends") {
      if (!user.owner) throw new HttpError(403, "Необходим е собственик.");
      const weeks =
        await sql`SELECT week::text,base,supplements,paid FROM staff_weekly_costs(${month})`;
      const months =
        await sql`SELECT to_char(m,'YYYY-MM') AS "month",sum((s->>'gross')::numeric) gross,sum((s->>'bonus')::numeric) bonus,
        sum((s->>'payments')::numeric+(s->>'advances')::numeric) paid,sum((s->>'extra')::numeric) extra
        FROM generate_series(${month}::date-interval '2 months',${month}::date,interval '1 month') m CROSS JOIN staff_employees e
        CROSS JOIN LATERAL staff_statement(e.id,m::date) s GROUP BY m ORDER BY m`;
      return json({ weeks, months });
    }
    if (emp) {
      const operational = await sql`SELECT
        (SELECT jsonb_agg(to_jsonb(s) ORDER BY starts) FROM staff_shifts s WHERE employee_id=${emp} AND staff_day(ends)>=${month}::date AND staff_day(starts)<${month}::date+interval '1 month') shifts,
        (SELECT jsonb_agg(to_jsonb(t) ORDER BY starts DESC) FROM staff_time_entries t WHERE employee_id=${emp} AND (ends IS NULL OR staff_day(starts)>=${month}::date AND staff_day(starts)<${month}::date+interval '1 month')) times,
        (SELECT jsonb_agg(to_jsonb(l) ORDER BY first_day) FROM staff_leave_requests l WHERE employee_id=${emp} AND last_day>=${month}::date AND first_day<${month}::date+interval '1 month') leaves`;
      const finance = user.owner
        ? (
            await sql`SELECT staff_statement(${emp},${month}) slip,
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY effective DESC) FROM staff_contracts c WHERE employee_id=${emp}) contracts,
        (SELECT jsonb_agg(to_jsonb(b) ORDER BY booked DESC) FROM staff_bonus_requests b WHERE employee_id=${emp} AND period=${month}) bonuses,
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY booked DESC) FROM staff_amounts a WHERE employee_id=${emp} AND period=${month}) amounts,
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY changed_at DESC) FROM (SELECT action,actor,changed_at,payload FROM staff_audit_log WHERE employee_id=${emp} ORDER BY changed_at DESC LIMIT 100)a) history`
          )[0]
        : {};
      return json({ ...operational[0], ...finance });
    }
    const employees =
      await sql`SELECT id,name,position,active FROM staff_employees ORDER BY name,id`;
    const shifts =
      await sql`SELECT * FROM staff_shifts WHERE staff_day(ends)>=${month}::date-7 AND staff_day(starts)<${month}::date+interval '1 month 7 days' ORDER BY starts`;
    const leaves =
      await sql`SELECT id,employee_id,first_day::text,last_day::text,kind,status FROM staff_leave_requests WHERE last_day>=${month}::date AND first_day<${month}::date+interval '1 month' ORDER BY first_day`;
    const clock =
      await sql`SELECT count(DISTINCT employee_id) FILTER(WHERE ends IS NULL) working,
      count(*) FILTER(WHERE NOT confirmed AND staff_day(starts)>=${month}::date AND staff_day(starts)<${month}::date+interval '1 month') pending,
      coalesce(round(sum(extract(epoch from ends-starts)/3600-pause/60.0) FILTER(WHERE confirmed AND date_trunc('week',staff_day(starts))=date_trunc('week',staff_day(now()))),2),0) week_hours,
      coalesce(round(sum(extract(epoch from ends-starts)/3600-pause/60.0) FILTER(WHERE confirmed AND staff_day(starts)>=${month}::date AND staff_day(starts)<${month}::date+interval '1 month'),2),0) hours,
      (SELECT count(*) FROM staff_shifts WHERE staff_day(starts)=staff_day(now())) today,
      (SELECT count(DISTINCT employee_id) FROM staff_leave_requests WHERE status='approved' AND staff_day(now()) BETWEEN first_day AND last_day) absent FROM staff_time_entries`;
    const warnings =
      await sql`SELECT employee_id,work_day::text,kind,hours,minimum FROM staff_rest_warnings(${month})`;
    const payroll = user.owner
      ? await sql`SELECT e.id,staff_statement(e.id,${month}::date) slip,c.mode,c.rate,d.due::text,staff_planned_extra(e.id,${month}) planned FROM staff_employees e LEFT JOIN staff_pay_dates d ON d.employee_id=e.id AND d.period=${month}
      LEFT JOIN LATERAL (SELECT mode,rate FROM staff_contracts WHERE employee_id=e.id AND effective<${month}::date+interval '1 month' ORDER BY effective DESC LIMIT 1)c ON true`
      : [];
    return json({
      budget: user.owner
        ? ((
            await sql`SELECT amount FROM staff_month_budgets WHERE period=${month}`
          )[0]?.amount ?? null)
        : null,
      employees,
      shifts,
      leaves,
      clock: clock[0],
      payroll,
      warnings,
      owner: user.owner,
    });
  } catch (e) {
    return handle(e);
  }
}
