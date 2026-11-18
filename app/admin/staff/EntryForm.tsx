import { useState } from "react";
import { kinds, modes, today } from "./model";
export type InputData = Record<string, string | number | boolean>;
export type FormSpec = { action: string; values?: InputData };
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: Record<string, string>;
  value?: string | number;
  min?: number;
  max?: number;
};
const start: Field = {
  key: "start",
  label: "Начало · София",
  type: "datetime-local",
};
const end: Field = {
  key: "end",
  label: "Край · София",
  type: "datetime-local",
};
const pause: Field = {
  key: "pause",
  label: "Почивка (мин)",
  type: "integer",
  value: 0,
  min: 0,
  max: 1439,
};
const date: Field = { key: "date", label: "Дата", type: "date" };
const reason: Field = { key: "reason", label: "Основание" };
const fields: Record<string, Field[]> = {
  contract: [
    { ...date, label: "В сила от" },
    { key: "employment", label: "Тип заетост", value: "Пълно работно време" },
    { key: "mode", label: "Режим", options: modes },
    { key: "rate", label: "Ставка (€)", type: "amount" },
    {
      key: "hours",
      label: "Договорени часа седмично",
      type: "decimal",
      min: 0.01,
      max: 168,
    },
    {
      key: "rest",
      label: "Минимална междудневна почивка по договор (ч)",
      type: "decimal",
      min: 0,
      max: 168,
    },
    {
      key: "weeklyRest",
      label: "Минимална седмична почивка по договор (ч)",
      type: "decimal",
      min: 0,
      max: 168,
    },
  ],
  cancel: [reason],
  shift: [start, end, pause],
  time: [
    start,
    end,
    pause,
    reason,
    { key: "confirmed", label: "Потвърден отчет", type: "checkbox" },
  ],
  finish: [pause, reason],
  leave: [
    { ...date, label: "От" },
    { key: "until", label: "До включително", type: "date" },
    {
      key: "kind",
      label: "Вид",
      options: Object.fromEntries(
        ["paid", "unpaid", "sick", "other", "rest"].map((k) => [k, kinds[k]]),
      ),
    },
  ],
  bonusRequest: [
    date,
    { key: "amount", label: "Сума (€)", type: "amount" },
    reason,
  ],
  money: [
    date,
    {
      key: "kind",
      label: "Вид",
      options: Object.fromEntries(
        [
          "bonus",
          "advance",
          "payment",
          "overtime",
          "night",
          "holiday",
          "deduction",
        ].map((k) => [k, kinds[k]]),
      ),
    },
    { key: "amount", label: "Сума (€)", type: "amount" },
    reason,
  ],
  close: [
    { key: "net", label: "Потвърдено нетно по ведомост (€)", type: "amount" },
    reason,
  ],
};
export const titles: Record<string, string> = {
  bonusRequest: "Предложи бонус",
  bonusDecision: "Решение за бонус",
  cancel: "Отмяна на смяна",
  contract: "Договор и ставка",
  shift: "Планирана смяна",
  time: "Отчет на часове",
  start: "Начало на смяна",
  finish: "Край на смяна",
  leave: "Заявка за отсъствие",
  decision: "Решение за отпуск",
  money: "Финансов запис",
  close: "Приключване на месеца",
};
export default function EntryForm({
  spec,
  period,
  employee,
  save,
  cancel,
  busy,
}: {
  spec: FormSpec;
  period: string;
  employee: string;
  save: (data: InputData) => void;
  cancel: () => void;
  busy: boolean;
}) {
  const { action, values = {} } = spec;
  const [kind, setKind] = useState(String(values.kind || "bonus"));
  const list = [...(fields[action] || [])];
  if (action === "shift")
    list.push(
      values.id
        ? reason
        : {
            key: "repeat",
            label: "Брой седмици (включително тази)",
            type: "integer",
            value: 1,
            min: 1,
            max: 52,
          },
    );
  if (action === "money" && ["advance", "payment"].includes(kind))
    list.push({
      key: "method",
      label: "Метод",
      options: { bank: "Банков превод", cash: "В брой" },
    });
  return (
    <form
      className="sw-form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = { ...values };
        for (const f of list) {
          const v = String(fd.get(f.key) ?? "");
          data[f.key] =
            f.type === "checkbox"
              ? fd.has(f.key)
              : ["integer", "decimal"].includes(f.type || "")
                ? Number(v)
                : v;
        }
        if (["money", "close", "bonusRequest"].includes(action))
          data.period = period + "-01";
        if (action === "cancel" && !confirm("Отмяна на тази планирана смяна?"))
          return;
        if (
          action === "close" &&
          !confirm("Заключване на периода за този служител?")
        )
          return;
        save(data);
      }}
    >
      <h3>
        {titles[action]} · {employee}
      </h3>
      <fieldset disabled={busy}>
        {list.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.options ? (
              <select
                name={f.key}
                defaultValue={String(
                  values[f.key] ?? Object.keys(f.options)[0],
                )}
                onChange={(e) => f.key === "kind" && setKind(e.target.value)}
              >
                {Object.entries(f.options).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                name={f.key}
                defaultChecked={Boolean(values[f.key])}
              />
            ) : (
              <input
                required
                name={f.key}
                type={
                  ["integer", "amount", "decimal"].includes(f.type || "")
                    ? "number"
                    : f.type || "text"
                }
                step={
                  f.type === "integer"
                    ? 1
                    : ["amount", "decimal"].includes(f.type || "")
                      ? "0.01"
                      : undefined
                }
                min={f.min ?? (f.type === "amount" ? 0 : undefined)}
                max={f.max}
                maxLength={500}
                list={
                  ["money", "bonusRequest"].includes(action) &&
                  f.key === "reason"
                    ? "staff-bonus-reasons"
                    : undefined
                }
                defaultValue={String(
                  values[f.key] ??
                    f.value ??
                    (f.type === "date"
                      ? today().startsWith(period)
                        ? today()
                        : period + "-01"
                      : ""),
                )}
              />
            )}
          </label>
        ))}
        <datalist id="staff-bonus-reasons">
          {[
            "Отлично представяне",
            "Постигнат оборот",
            "Допълнителна смяна",
            "Месечен бонус",
            "Индивидуален бонус",
            "Друг бонус",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </datalist>
        <button className="cms-btn primary">Запази</button>
        <button className="cms-btn" type="button" onClick={cancel}>
          Отказ
        </button>
      </fieldset>
    </form>
  );
}
