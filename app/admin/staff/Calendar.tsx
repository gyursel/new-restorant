import { useState } from "react";
import {
  addDays,
  csv,
  dateLabel,
  local,
  monday,
  today,
  type Dashboard,
  type Shift,
} from "./model";
type Props = {
  data: Dashboard;
  period: string;
  setPeriod: (v: string) => void;
  edit: (emp: string, shift?: Shift, day?: string) => void;
  move: (s: Shift, day: string) => void;
  copy: (day: string) => void;
};
export default function Calendar({
  data,
  period,
  setPeriod,
  edit,
  move,
  copy,
}: Props) {
  const [mode, setMode] = useState("week"),
    [selected, setSelected] = useState(today()),
    [minimum, setMinimum] = useState(""),
    [maximum, setMaximum] = useState("");
  const anchor = selected.startsWith(period) ? selected : period + "-01";
  const first =
    mode === "week"
      ? monday(anchor)
      : mode === "month"
        ? period + "-01"
        : anchor;
  const count =
    mode === "week"
      ? 7
      : mode === "month"
        ? new Date(
            Number(period.slice(0, 4)),
            Number(period.slice(5)),
            0,
          ).getDate()
        : 1;
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  const name = (id: string) =>
    data.employees.find((e) => e.id === id)?.name || "";
  const select = (d: string) => {
    setSelected(d);
    setPeriod(d.slice(0, 7));
  };
  const span = (v: string) => local(v).slice(11);
  return (
    <section>
      <div className="sw-tools">
        <select
          aria-label="Изглед на графика"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="day">Ден</option>
          <option value="week">Седмица</option>
          <option value="month">Месец</option>
        </select>
        <input
          aria-label="Дата на графика"
          type="date"
          value={anchor}
          onChange={(e) => e.target.value && select(e.target.value)}
        />
        <button onClick={() => copy(monday(anchor))}>
          Копирай предходната седмица
        </button>
        <button onClick={() => window.print()}>Печат</button>
        <button
          onClick={() =>
            csv("grafik", [
              ["Служител", "Начало", "Край", "Почивка (мин)"],
              ...data.shifts
                .filter((s) => days.includes(local(s.starts).slice(0, 10)))
                .map((s) => [
                  name(s.employee_id),
                  local(s.starts),
                  local(s.ends),
                  s.pause,
                ]),
            ])
          }
        >
          CSV
        </button>
      </div>
      {data.warnings.length > 0 && (
        <details>
          <summary>Проверка на почивките · {data.warnings.length}</summary>
          {data.warnings.map((w, i) => (
            <p key={i}>
              {name(w.employee_id)} · {dateLabel(w.work_day)} ·{" "}
              {w.kind === "daily" ? "Междудневна" : "Седмична"} почивка{" "}
              {w.hours} ч при зададени {w.minimum} ч
            </p>
          ))}
        </details>
      )}
      <details>
        <summary>Целеви брой служители за деня</summary>
        <div className="sw-tools">
          <label>
            Минимум
            <input
              type="number"
              min="0"
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
          </label>
          <label>
            Максимум
            <input
              type="number"
              min="0"
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
            />
          </label>
        </div>
      </details>
      <div className={"sw-calendar " + mode}>
        {days.map((day) => {
          const shifts = data.shifts.filter(
            (s) =>
              local(s.starts).slice(0, 10) <= day &&
              local(new Date(new Date(s.ends).getTime() - 1)).slice(0, 10) >=
                day,
          );
          const people = new Set(shifts.map((s) => s.employee_id)).size;
          return (
            <div
              className="sw-day"
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const s = data.shifts.find(
                  (x) => x.id === e.dataTransfer.getData("text/plain"),
                );
                if (s) move(s, day);
              }}
            >
              <strong>
                {new Date(day + "T12:00Z").toLocaleDateString("bg-BG", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </strong>
              {shifts.map((s) => (
                <button
                  className="sw-shift"
                  key={s.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", s.id)
                  }
                  onClick={() => edit(s.employee_id, s)}
                >
                  <b>{name(s.employee_id)}</b>
                  {span(s.starts)} – {span(s.ends)}
                </button>
              ))}
              {data.leaves
                .filter(
                  (l) =>
                    l.status === "approved" &&
                    l.first_day <= day &&
                    l.last_day >= day,
                )
                .map((l) => (
                  <small key={l.id}>Отсъства · {name(l.employee_id)}</small>
                ))}
              {minimum && people < Number(minimum) && (
                <small>Под минимума</small>
              )}
              {maximum && people > Number(maximum) && (
                <small>Над максимума</small>
              )}
              <button
                aria-label={"Добави смяна за " + dateLabel(day)}
                onClick={() => edit("", undefined, day)}
              >
                + Смяна
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
