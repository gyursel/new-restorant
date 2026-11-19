import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const migrations = new URL("../../database/", import.meta.url);
const files = (await readdir(migrations))
  .filter((v) => /^staff-\d+\.sql$/.test(v))
  .sort();
for (let i = 0; i < 2; i++)
  for (const f of files)
    await db.exec(await readFile(new URL(f, migrations), "utf8"));
const emp = crypto.randomUUID(),
  other = crypto.randomUUID(),
  m = "2024-01-01";
for (const id of [emp, other])
  await db.query(
    "insert into staff_employees(id,name,position,hired_on) values($1,'Тест Име','Касиер','2023-01-01')",
    [id],
  );
const act = (action, data, id = emp, key = crypto.randomUUID()) =>
  db.query("select staff_record($1,$2,$3,$4::jsonb,$5)", [
    id,
    key,
    action,
    JSON.stringify(data),
    "QA",
  ]);
const slip = async (id = emp) =>
  (await db.query("select staff_statement($1,$2) s", [id, m])).rows[0].s;
const rate = {
  date: m,
  mode: "hour",
  rate: "10.25",
  hours: 40,
  employment: "Тестов договор",
  rest: 12,
  weeklyRest: 48,
};
const shift = {
  start: "2024-01-08T21:00",
  end: "2024-01-09T05:30",
  pause: 30,
  repeat: 1,
};
const time = {
  start: shift.start,
  end: shift.end,
  pause: 30,
  confirmed: true,
  reason: "Ръчен отчет",
};
const money = (kind, amount) => ({
  kind,
  amount,
  period: m,
  date: "2024-02-02",
  reason: "Тест",
  ...(["advance", "payment"].includes(kind) ? { method: "bank" } : {}),
});
await act("contract", rate);
await act("shift", shift);
await assert.rejects(act("shift", shift), /застъпване/);
await act("time", time);
assert.equal((await slip()).base, 82);
assert.equal((await slip()).hours, 8);
await act("contract", { ...rate, rate: "11.25" });
assert.equal((await slip()).base, 90);
await act("contract", { ...rate, mode: "day", rate: "85.17" });
assert.equal((await slip()).base, 85.17);
await act("contract", { ...rate, mode: "month", rate: "1550" }, other);
assert.equal((await slip(other)).base, 1550);
await act(
  "contract",
  { ...rate, mode: "month", rate: "3100", date: "2024-01-16" },
  other,
);
assert.equal((await slip(other)).base, 2350);
const proposed = crypto.randomUUID();
await act("bonusRequest", { ...money("bonus", "8.44") }, other, proposed);
assert.equal((await slip(other)).bonus, 0);
await act("bonusDecision", { id: proposed, status: "approved" }, other);
assert.equal((await slip(other)).bonus, 8.44);
await assert.rejects(
  act("bonusDecision", { id: proposed, status: "approved" }, other),
);
const request = crypto.randomUUID();
await act("money", money("bonus", "20.03"), emp, request);
await act("money", money("bonus", "20.03"), emp, request);
assert.equal((await slip()).gross, 105.2);
await assert.rejects(
  act("money", money("bonus", "23"), emp, request),
  /използван/,
);
await act("money", money("advance", "12.50"));
await act("money", money("payment", "10.00"));
assert.equal((await slip()).remaining, 82.7);
const leave = crypto.randomUUID();
await act(
  "leave",
  { date: "2024-01-20", until: "2024-01-22", kind: "paid" },
  emp,
  leave,
);
await act("decision", { id: leave, status: "approved" });
await assert.rejects(
  act("shift", {
    ...shift,
    start: "2024-01-20T12:00",
    end: "2024-01-20T16:00",
  }),
  /застъпване/,
);
await db.query("select staff_copy_week($1,$2,$3)", [
  "2024-01-15",
  crypto.randomUUID(),
  "QA",
]);
const incomplete = crypto.randomUUID();
await act(
  "time",
  {
    ...time,
    start: "2024-01-10T09:00",
    end: "2024-01-10T12:00",
    confirmed: false,
  },
  emp,
  incomplete,
);
await assert.rejects(
  act("close", { period: m, net: 90, reason: "QA" }),
  /непотвърдени/,
);
await act("time", {
  ...time,
  start: "2024-01-10T09:00",
  end: "2024-01-10T12:00",
  id: incomplete,
  version: 1,
});
await act("close", { period: m, net: 90, reason: "Ведомост" });
assert.equal((await slip()).remaining, 67.5);
await assert.rejects(act("contract", rate), /заключен/);
await assert.rejects(act("money", money("bonus", "1")), /заключен/);
await act("money", money("payment", "67.50"));
assert.equal((await slip()).remaining, 0);
await assert.rejects(act("money", money("payment", "0.01")), /надхвърля/);
await act("contract", { ...rate, date: "2024-02-01", rate: "1000" });
assert.equal((await slip()).net, 90);
await assert.rejects(
  db.query("update staff_employees set hired_on='2025-01-01' where id=$1", [
    emp,
  ]),
  /Датата/,
);
await act("start", {}, other);
await assert.rejects(act("start", {}, other), /застъпва/);
await assert.rejects(
  db.query("update staff_employees set active=false where id=$1", [other]),
  /приключи/,
);
const audited = await db.query(
  "select payload->'before' previous from staff_audit_log where action='time' and payload ? 'before'",
);
assert.equal(audited.rows.length, 1);
assert.equal(audited.rows[0].previous.confirmed, false);
await db.close();
console.log(
  "PASS migrations twice, hourly/daily/monthly and effective dates, overnight attendance, overlap, leave approval, week copy, retroactive rate, advance, partial/final payments, idempotency, immutable snapshot, open clock and audit trail",
);
