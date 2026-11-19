import { z } from "zod";
import {
  authorize,
  db,
  failure,
  HttpError,
  json,
  sameOrigin,
} from "../../../../server/cms";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
function validPhoto(value: string, limit: number) {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(value);
  if (
    !match ||
    match[2].length % 4 !== 0 ||
    (match[2].length / 4) * 3 - (match[2].match(/=/g)?.length || 0) > limit
  )
    return false;
  const header = atob(match[2].slice(0, 24));
  return match[1] === "jpeg"
    ? header.startsWith("\xff\xd8\xff")
    : match[1] === "png"
      ? header.startsWith("\x89PNG\r\n\x1a\n")
      : header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
}
const employee = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().min(0),
    name: z.string().trim().min(2).max(120),
    position: z.string().trim().min(2).max(80),
    hired_on: z.string().date(),
    active: z.boolean(),
    notes: z.string().trim().max(1000).optional(),
    phone: z.string().trim().max(48).optional(),
    address: z.string().trim().max(350).optional(),
    photo: z
      .string()
      .refine((v) => !v || validPhoto(v, 1048576))
      .optional(),
  })
  .strict();

function staffError(error: unknown) {
  if ((error as { code?: string })?.code === "P0001")
    return failure(new HttpError(409, (error as Error).message));
  if ((error as { code?: string })?.code === "42P01") {
    return failure(
      new HttpError(
        503,
        "Регистърът изисква миграцията staff-001.sql в базата за тази среда.",
      ),
    );
  }
  return failure(error);
}

export async function GET(request: Request) {
  try {
    await authorize();
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new HttpError(400, "Невалидна страница.");
    const query = (params.get("q") || "").trim().slice(0, 120);
    const sql = db();
    if (params.has("id")) {
      const id = uuid.parse(params.get("id"));
      if (params.has("slot")) {
        const slot = z.coerce
          .number()
          .int()
          .min(1)
          .max(6)
          .parse(params.get("slot"));
        const rows =
          await sql`SELECT image FROM staff_contract_photos WHERE employee_id=${id} AND slot=${slot}`;
        if (!rows.length) throw new HttpError(404, "Няма такава снимка.");
        return json(rows[0]);
      }
      if (params.has("portrait"))
        return json(
          (await sql`SELECT photo FROM staff_employees WHERE id=${id}`)[0] || {
            photo: "",
          },
        );
      const rows =
        await sql`SELECT id,name,position,hired_on::text,active,version,notes,phone,address,photo FROM staff_employees WHERE id=${id}`;
      if (!rows.length) throw new HttpError(404, "Няма такъв служител.");
      const pages =
        await sql`SELECT slot FROM staff_contract_photos WHERE employee_id=${id} ORDER BY slot`;
      return json({
        employee: rows[0],
        pages: pages.map((p) => Number(p.slot)),
      });
    }
    const rows =
      await sql`SELECT id, name, position, hired_on::text, active, version
      FROM staff_employees WHERE strpos(lower(name || ' ' || position), lower(${query})) > 0
      ORDER BY name, id LIMIT 26 OFFSET ${(page - 1) * 25}`;
    return json({ employees: rows.slice(0, 25), more: rows.length > 25 });
  } catch (error) {
    return staffError(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await authorize();
    const raw = await request.text();
    if (raw.length > 2900000) throw new HttpError(413, "Твърде голяма заявка.");
    const body = JSON.parse(raw);
    if (body.action === "contractPhoto") {
      const { id, slot, image } = z
        .object({
          id: uuid,
          slot: z.number().int().min(1).max(6),
          image: z.string().refine((v) => validPhoto(v, 2097152)),
        })
        .parse(body);
      const rows =
        await db()`INSERT INTO staff_contract_photos(employee_id,slot,image,actor) VALUES(${id},${slot},${image},${actor}) ON CONFLICT DO NOTHING RETURNING slot`;
      if (!rows.length)
        throw new HttpError(409, "Страницата вече е заета. Обнови досието.");
      return json({ ok: true });
    }
    const result = employee.safeParse(body);
    if (!result.success)
      throw new HttpError(
        400,
        "Провери името, длъжността и датата на назначаване.",
      );
    const e = result.data;
    const sql = db();
    const change =
      e.version === 0
        ? sql`INSERT INTO staff_employees (id,name,position,hired_on,active,notes,photo,phone,address)
          VALUES (${e.id},${e.name},${e.position},${e.hired_on},${e.active},${e.notes ?? ""},${e.photo ?? ""},${e.phone ?? ""},${e.address ?? ""})
          ON CONFLICT DO NOTHING RETURNING *`
        : sql`UPDATE staff_employees SET name=${e.name},position=${e.position},hired_on=${e.hired_on},
          phone=coalesce(${e.phone ?? null},phone),address=coalesce(${e.address ?? null},address),notes=coalesce(${e.notes ?? null},notes),photo=coalesce(${e.photo ?? null},photo),active=${e.active},version=version+1 WHERE id=${e.id} AND version=${e.version} RETURNING *`;
    const rows = await sql`WITH changed AS (${change})
      INSERT INTO staff_employee_audit (employee_id,version,actor,snapshot)
      SELECT id,version,${actor},to_jsonb(changed)-'photo' FROM changed RETURNING version`;
    if (!rows.length)
      throw new HttpError(
        409,
        "Записът е променен. Презареди регистъра преди редакция.",
      );
    return json({ version: rows[0].version });
  } catch (error) {
    if (error instanceof SyntaxError)
      return failure(new HttpError(400, "Невалидни данни."));
    return staffError(error);
  }
}
