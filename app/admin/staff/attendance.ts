import { local, type Shift, type Time } from "./model";
// Match the closest shift on the business date, including actual starts shortly before midnight.
export function variance(actual: Time, shifts: Shift[]) {
  const start = Date.parse(actual.starts),
    end = actual.ends ? Date.parse(actual.ends) : null;
  const candidates = shifts.filter(
    (s) =>
      local(s.starts).slice(0, 10) === local(actual.starts).slice(0, 10) ||
      (start < Date.parse(s.ends) && (end ?? start) > Date.parse(s.starts)),
  );
  const plan = candidates.sort(
    (a, b) =>
      Math.abs(Date.parse(a.starts) - start) -
      Math.abs(Date.parse(b.starts) - start),
  )[0];
  if (!plan) return "Без планирана смяна";
  const late = Math.max(
    0,
    Math.round((start - Date.parse(plan.starts)) / 60000),
  );
  if (end === null) return late ? "Закъснение " + late + " мин" : "По график";
  const early = Math.max(0, Math.round((Date.parse(plan.ends) - end) / 60000));
  const delta =
    Math.round(
      (end - start - Date.parse(plan.ends) + Date.parse(plan.starts)) / 60000,
    ) -
    actual.pause +
    plan.pause;
  return [
    "Закъснение " + late + " мин",
    "Ранен край " + early + " мин",
    "Допълнително " + Math.max(0, delta) + " мин",
  ].join(" · ");
}
