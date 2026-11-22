import { useState } from "react";
import { money, request, today, type Dashboard } from "./model";
import { downloadSlip } from "./payslip";
export function forecast(data: Dashboard) {
  return (
    data.payroll.reduce(
      (sum, p) =>
        sum +
        Math.round(p.slip.gross * 100) +
        Math.round(Number(p.planned || 0) * 100),
      0,
    ) / 100
  );
}
export default function PayAgenda({
  data,
  period,
  reload,
  pay,
}: {
  data: Dashboard;
  period: string;
  reload: () => void;
  pay: (id: string) => void;
}) {
  const [edit, setEdit] = useState(""),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const projection = forecast(data),
    balance = data.budget === null ? null : Number(data.budget) - projection;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/staff/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          edit === "budget"
            ? { action: "budget", period: period + "-01", amount: value }
            : {
                action: "payDate",
                period: period + "-01",
                employee: edit,
                due: value,
              },
        ),
      });
      setEdit("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function change(id: string, v: string) {
    setError("");
    setEdit(id);
    setValue(v);
  }
  const entries = data.payroll
    .map((p) => ({
      ...p,
      employee: data.employees.find((e) => e.id === p.id)!,
    }))
    .filter((p) => p.employee.active || p.slip.remaining || p.due)
    .sort(
      (a, b) =>
        (a.due || "9999").localeCompare(b.due || "9999") ||
        a.employee.name.localeCompare(b.employee.name, "bg"),
    );
  return (
    <section>
      <div className="sw-budget">
        <div>
          <small>Месечен бюджет</small>
          <h3>
            {data.budget === null
              ? "Няма зададен бюджет"
              : money(Number(data.budget))}
          </h3>
          <span>Прогноза по график и отчети · {money(projection)}</span>
          {balance !== null && (
            <p>
              {balance < 0 ? "Над бюджета" : "Свободни средства"} ·{" "}
              {money(Math.abs(balance))}
            </p>
          )}
        </div>
        <button onClick={() => change("budget", String(data.budget ?? ""))}>
          {data.budget === null ? "Задай бюджет" : "Промени бюджета"}
        </button>
      </div>
      {edit && (
        <form className="sw-tools" onSubmit={save}>
          <label>
            {edit === "budget"
              ? "Бюджет за " + period + " (€)"
              : "Дата за плащане · " +
                entries.find((p) => p.id === edit)?.employee.name}
            <input
              autoFocus
              required
              type={edit === "budget" ? "number" : "date"}
              min={edit === "budget" ? "0" : undefined}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button disabled={busy}>Запази</button>
          <button type="button" disabled={busy} onClick={() => setEdit("")}>
            Отказ
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <h3>Календар на плащанията</h3>
      {!entries.length && <p>Няма служители за този месец.</p>}
      {entries.map((p, i) => (
        <div key={p.id}>
          {(!i || p.due !== entries[i - 1].due) && (
            <h4>
              {p.due
                ? new Date(p.due + "T12:00Z").toLocaleDateString("bg-BG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Без определена дата"}
            </h4>
          )}
          <div className="sw-payrow">
            <div>
              <strong>{p.employee.name}</strong>
              <small>
                {p.slip.closed ? "Остатък" : "Прогнозен остатък"} ·{" "}
                {money(p.slip.remaining)}
                {p.due &&
                p.due < today() &&
                p.slip.closed &&
                p.slip.remaining > 0
                  ? " · Просрочено"
                  : ""}
              </small>
            </div>
            <button onClick={() => change(p.id, p.due || "")}>
              {p.due ? "Промени датата" : "Задай дата"}
            </button>
            <button onClick={() => pay(p.id)}>Отчети плащане</button>
            <button
              onClick={() => downloadSlip(p.employee.name, period, p.slip)}
            >
              Фиш PDF
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
