import { z } from 'zod';
import { authorize, db, failure, HttpError, json, sameOrigin } from '../../../../server/cms';

export const dynamic = 'force-dynamic';

const employee = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  name: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(80),
  hired_on: z.string().date(),
  active: z.boolean(),
}).strict();

function staffError(error: unknown) {
  if ((error as {code?: string})?.code === '42P01') {
    return failure(new HttpError(503, 'Регистърът изисква миграцията staff-001.sql в базата за тази среда.'));
  }
  return failure(error);
}

export async function GET(request: Request) {
  try {
    await authorize();
    const params = new URL(request.url).searchParams;
    const page = Number(params.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new HttpError(400, 'Невалидна страница.');
    const query = (params.get('q') || '').trim().slice(0, 120);
    const sql = db();
    const rows = await sql`SELECT id, name, position, hired_on::text, active, version
      FROM staff_employees WHERE strpos(lower(name || ' ' || position), lower(${query})) > 0
      ORDER BY name, id LIMIT 26 OFFSET ${(page - 1) * 25}`;
    return json({employees: rows.slice(0, 25), more: rows.length > 25});
  } catch (error) { return staffError(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await authorize();
    const raw = await request.text();
    if (raw.length > 4000) throw new HttpError(413, 'Твърде голяма заявка.');
    const result = employee.safeParse(JSON.parse(raw));
    if (!result.success) throw new HttpError(400, 'Провери името, длъжността и датата на назначаване.');
    const e = result.data;
    const sql = db();
    const change = e.version === 0
      ? sql`INSERT INTO staff_employees (id,name,position,hired_on,active)
          VALUES (${e.id},${e.name},${e.position},${e.hired_on},${e.active})
          ON CONFLICT DO NOTHING RETURNING *`
      : sql`UPDATE staff_employees SET name=${e.name},position=${e.position},hired_on=${e.hired_on},
          active=${e.active},version=version+1 WHERE id=${e.id} AND version=${e.version} RETURNING *`;
    const rows = await sql`WITH changed AS (${change})
      INSERT INTO staff_employee_audit (employee_id,version,actor,snapshot)
      SELECT id,version,${actor},to_jsonb(changed) FROM changed RETURNING version`;
    if (!rows.length) throw new HttpError(409, 'Записът е променен. Презареди регистъра преди редакция.');
    return json({version: rows[0].version});
  } catch (error) {
    if (error instanceof SyntaxError) return failure(new HttpError(400, 'Невалидни данни.'));
    return staffError(error);
  }
}
