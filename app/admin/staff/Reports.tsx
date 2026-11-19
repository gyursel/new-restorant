import { useEffect, useState } from "react";
import { csv, money, request, type Dashboard } from "./model";
export default function Reports({
  data,
  period,
}: {
  data: Dashboard;
  period: string;
}) {
  const [compare, setCompare] = useState(""),
    [other, setOther] = useState<Dashboard | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    setOther(null);
    setError("");
    if (!compare) return;
    const c = new AbortController();
    request<Dashboard>("/api/admin/staff/workspace?period=" + compare + "-01", {
      signal: c.signal,
    })
      .then(setOther)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [compare]);
  const [trends, setTrends] = useState<{
    weeks: { week: string; base: number; supplements: number; paid: number }[];
    months: {
      month: string;
      gross: number;
      bonus: number;
      paid: number;
      extra: number;
    }[];
  } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    setTrends(null);
    request<NonNullable<typeof trends>>(
      "/api/admin/staff/workspace?view=trends&period=" + period + "-01",
      { signal: c.signal },
    )
      .then(setTrends)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [period, data]);
  const total = (d: Dashboard, k: "gross" | "bonus" | "extra") =>
    d.payroll.reduce((a, x) => a + Math.round(x.slip[k] * 100), 0) / 100;
  const rows = data.payroll.map((x) => ({
    employee: data.employees.find((e) => e.id === x.id)!,
    ...x.slip,
  }));
  const byRole = new Map<string, number>();
  rows.forEach((r) =>
    byRole.set(
      r.employee.position,
      (byRole.get(r.employee.position) || 0) + Math.round(r.gross * 100),
    ),
  );
  const maximum = Math.max(1, ...byRole.values());
  return (
    <section>
      <div className="sw-tools">
        <h3>Разходи за персонал</h3>
        <label>
          Сравни с месец
          <input
            type="month"
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
          />
        </label>
        <button
          onClick={() =>
            csv("razhodi-" + period, [
              [
                "Служител",
                "Длъжност",
                "Брутно",
                "Бонуси",
                "Доплащания",
                "Удръжки",
                "Нетно",
                "Плащания",
                "Аванси",
                "Остатък",
              ],
              ...rows.map((r) => [
                r.employee.name,
                r.employee.position,
                r.gross,
                r.bonus,
                r.extra,
                r.deductions,
                r.net ?? "",
                r.payments,
                r.advances,
                r.remaining,
              ]),
            ])
          }
        >
          Експорт CSV
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="sw-cards">
        {(["gross", "bonus", "extra"] as const).map((k, i) => (
          <article key={k}>
            <small>{["Начислено брутно", "Бонуси", "Доплащания"][i]}</small>
            <b>{money(total(data, k))}</b>
            {other && (
              <small>
                {compare} · {money(total(other, k))}
              </small>
            )}
          </article>
        ))}
      </div>
      <h3>Начислено по длъжности</h3>
      {[...byRole]
        .sort((a, b) => b[1] - a[1])
        .map(([role, v]) => (
          <div key={role} className="sw-bar">
            <span>{role}</span>
            <meter value={v} max={maximum} />
            <strong>{money(v / 100)}</strong>
          </div>
        ))}
      <h3>Разходи по седмици</h3>
      {trends?.weeks.map((w) => (
        <div className="sw-bar" key={w.week}>
          <span>От {w.week}</span>
          <meter
            value={Number(w.base) + Number(w.supplements)}
            max={Math.max(
              1,
              ...trends.weeks.map(
                (x) => Number(x.base) + Number(x.supplements),
              ),
            )}
          />
          <strong>{money(Number(w.base) + Number(w.supplements))}</strong>
        </div>
      ))}
      <h3>Възнаграждения по месеци</h3>
      <div className="sw-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Месец",
                "Брутно",
                "Бонуси",
                "Доплащания",
                "Изплатено с аванси",
              ].map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trends?.months.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                {[m.gross, m.bonus, m.extra, m.paid].map((v, i) => (
                  <td key={i}>{money(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>План и отчет за месеца</h3>
      <p>
        {data.shifts
          .filter((s) =>
            new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia" })
              .format(new Date(s.starts))
              .startsWith(period),
          )
          .reduce(
            (a, s) =>
              a +
              (Date.parse(s.ends) - Date.parse(s.starts)) / 3600000 -
              s.pause / 60,
            0,
          )
          .toFixed(2)}{" "}
        ч планирани · {data.clock.hours} ч потвърдени
      </p>
    </section>
  );
}
