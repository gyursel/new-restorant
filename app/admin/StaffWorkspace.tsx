"use client";
import { useEffect, useState } from "react";
import {
  Banknote,
  ArrowUpRight,
  Clock3,
  Search,
  CalendarDays,
  ChartColumn,
  ClipboardClock,
  Users,
} from "lucide-react";
import { Avatar, ContractPages } from "./staff/StaffPhotos";
import { MenuCardFrame } from "../../src/components/site/MenuCardFrame";
import "../../src/ember-glass.css";
import StaffPanel from "./StaffPanel";
import { variance } from "./staff/attendance";
import Calendar from "./staff/Calendar";
import EntryForm, {
  titles,
  type FormSpec,
  type InputData,
} from "./staff/EntryForm";
import PayAgenda, { forecast } from "./staff/PayAgenda";
import Reports from "./staff/Reports";
import {
  addDays,
  csv,
  excel,
  dateLabel,
  kinds,
  local,
  modes,
  money,
  request,
  today,
  type Dashboard,
  type Profile,
  type Shift,
} from "./staff/model";
const endpoint = "/api/admin/staff/workspace";
const tabs = [
  ["overview", "Екип", ChartColumn],
  ["people", "Служители", Users],
  ["calendar", "График", CalendarDays],
  ["profile", "Досие и отчети", ClipboardClock],
  ["reports", "Плащания", Banknote],
] as const;
type Tab = (typeof tabs)[number][0];
function salaryForm(profile: Profile, period: string): FormSpec {
  const date = today().startsWith(period) ? today() : period + "-01";
  const c = profile.contracts?.find((row) => row.effective <= date);
  return {
    action: "salary",
    values: {
      date,
      mode: "month",
      ...(c && {
        employment: c.employment,
        hours: c.hours,
        rest: c.rest_hours,
        weeklyRest: c.weekly_rest,
        rate: c.mode === "month" ? c.rate : "",
      }),
    },
  };
}

export default function StaffWorkspace({
  manager = false,
}: {
  manager?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview"),
    [period, setPeriod] = useState(today().slice(0, 7)),
    [id, select] = useState("");
  const [data, setData] = useState<Dashboard | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [revision, refresh] = useState(0);
  const [spec, form] = useState<FormSpec | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("active"),
    [sort, setSort] = useState("name");
  const [retry, setRetry] = useState<{ key: string; signature: string } | null>(
    null,
  );
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    request<Dashboard>(endpoint + "?period=" + period + "-01", {
      signal: c.signal,
    })
      .then((d) => {
        setData(d);
        select((v) =>
          d.employees.some((e) => e.id === v) ? v : d.employees[0]?.id || "",
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [period, revision]);
  useEffect(() => {
    const c = new AbortController();
    setProfile(null);
    if (id)
      request<Profile>(endpoint + "?period=" + period + "-01&employee=" + id, {
        signal: c.signal,
      })
        .then(setProfile)
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        });
    return () => c.abort();
  }, [id, period, revision]);
  const selected = data?.employees.find((e) => e.id === id);
  function navigate(t: Tab) {
    setTab(t);
    form(null);
    setNotice("");
    setError("");
    if (tab === "people") refresh((v) => v + 1);
  }
  function open(action: string, values: InputData = {}) {
    setError("");
    setNotice("");
    setRetry(null);
    form({ action, values });
  }
  async function mutate(action: string, values: InputData, emp = id) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify([action, emp, values]);
    const key =
      retry?.signature === signature ? retry.key : crypto.randomUUID();
    setRetry({ signature, key });
    try {
      await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "copyWeek"
            ? { action, request: key, ...values }
            : { employee: emp, action, data: values, request: key },
        ),
      });
      if (action === "contract" && typeof values.date === "string")
        setPeriod(values.date.slice(0, 7));
      form(null);
      setRetry(null);
      setNotice("Промяната е запазена.");
      refresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function editShift(emp: string, s?: Shift, day?: string) {
    if (emp) select(emp);
    setTab("profile");
    open(
      "shift",
      s
        ? {
            id: s.id,
            version: s.version,
            start: local(s.starts),
            end: local(s.ends),
            pause: s.pause,
          }
        : {
            start: (day || today()) + "T09:00",
            end: (day || today()) + "T17:00",
          },
    );
  }
  const slip = profile?.slip;
  const sum = (k: "gross" | "bonus" | "advances" | "payments" | "remaining") =>
    (data?.payroll || []).reduce((n, p) => n + Math.round(p.slip[k] * 100), 0) /
    100;
  const cards = data
    ? [
        ["Общо служители", data.employees.length],
        ["Активни", data.employees.filter((x) => x.active).length],
        ["На смяна сега", data.clock.working],
        ["Отсъстващи днес", data.clock.absent],
        ["Смени днес", data.clock.today],
        ["Часове тази седмица", data.clock.week_hours],
        ["Часове за месеца", data.clock.hours],
        ...(data.owner
          ? [
              ["Начислено брутно", money(sum("gross"))],
              ["Изплатено с аванси", money(sum("payments") + sum("advances"))],
              ["Остатък¹", money(sum("remaining"))],
              ["Бонуси", money(sum("bonus"))],
            ]
          : []),
      ]
    : [];
  const payable = data?.payroll.filter((p) => p.slip.remaining > 0).length || 0;
  const rows = (data?.employees || [])
    .filter(
      (e) =>
        (status === "all" || e.active === (status === "active")) &&
        (e.name + " " + e.position)
          .toLocaleLowerCase("bg")
          .includes(search.toLocaleLowerCase("bg")),
    )
    .sort((a, b) =>
      sort === "position"
        ? a.position.localeCompare(b.position, "bg")
        : a.name.localeCompare(b.name, "bg"),
    );
  function salaryLabel(emp: string) {
    const p = data?.payroll.find((row) => row.id === emp);
    return p?.mode === "month" && p.rate != null
      ? money(Number(p.rate)) + " / месец"
      : "Въведи заплата";
  }
  function salary(emp: string) {
    pick(emp);
    open("salary");
  }
  function pick(emp: string) {
    select(emp);
    navigate("profile");
  }
  return (
    <div className="sw">
      <div className="sw-head">
        <img className="sw-chef" src="/images/head-chef-monochrome.webp" alt="" />
        <div>
          <small>CHEF’S <em>BURGER.</em></small>
          <h2>Персонал<span>.</span></h2>
        </div>
        <label>
          Отчетен месец
          <input
            type="month"
            value={period}
            onChange={(e) => {
              if (e.target.value) {
                setPeriod(e.target.value);
                form(null);
              }
            }}
          />
        </label>
        {manager && (
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.assign("/admin/login");
            }}
          >
            Изход
          </button>
        )}
      </div>
      <nav aria-label="Персонал">
        {tabs
          .filter(
            ([t]) =>
              !["people", "profile"].includes(t) &&
              (!manager || t !== "reports"),
          )
          .map(([t, label, Icon]) => (
            <button
              key={t}
              aria-current={
                tab === t ||
                (t === "overview" && ["people", "profile"].includes(tab))
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(t)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
      </nav>
      {error && (
        <p role="alert">
          {error} <button onClick={() => refresh((v) => v + 1)}>Обнови</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {tab === "people" ? (
        <StaffPanel onSalary={salary} salaryLabel={salaryLabel} />
      ) : !data ? (
        !error && <p role="status">Зареждане…</p>
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="sw-cards sw-summary">
                {[
                  ["На смяна сега", data.clock.working],
                  ["Смени днес", data.clock.today],
                  ...(data.owner
                    ? [
                        [
                          "Прогнозен остатък за плащане",
                          money(sum("remaining")),
                        ],
                      ]
                    : []),
                ].map(([k, v], index) => (
                  <article key={k}>
                    {index===0?<Users aria-hidden="true"/>:index===1?<CalendarDays aria-hidden="true"/>:<Banknote aria-hidden="true"/>}
                    <small>{k}</small>
                    <b>{v}</b>
                  </article>
                ))}
              </div>
              <div className="sw-tools sw-team-tools">
                <h3>Екип <span>{data.employees.filter(e=>e.active).length}</span></h3>
                <div className="sw-find"><Search size={16} aria-hidden="true"/>
                <input
                  aria-label="Търси в екипа"
                  placeholder="Търси по име или длъжност"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                /></div>
                {data.owner && (
                  <button onClick={() => navigate("people")}>
                    Управление на служители
                  </button>
                )}
              </div>
              <div className="staff-cards">
                {data.employees
                  .filter(
                    (e) =>
                      e.active &&
                      (e.name + " " + e.position)
                        .toLocaleLowerCase("bg")
                        .includes(search.toLocaleLowerCase("bg")),
                  )
                  .map((e) => {
                    const shift=data.shifts.find(s=>s.employee_id===e.id && local(s.starts).slice(0,10)===today());
                    return (
                    <MenuCardFrame key={e.id} className="staff-menu-card" photo={
                      <button className="food-card-photo" aria-label={"Досие · "+e.name} onClick={()=>pick(e.id)}>
                        <Avatar id={e.id} name={e.name} available={!!e.has_photo}/>
                      </button>}>
                      <button className="staff-name-link" onClick={()=>pick(e.id)}><h3>{e.name}</h3></button>
                      <span className="food-card-badge">{e.position}</span>
                      {data.owner && (e.phone ? <a className="staff-phone" href={"tel:"+e.phone.replace(/[^+0-9]/g,"")}>{e.phone}</a> : <span className="staff-phone">Няма въведен телефон</span>)}
                      <p className="staff-duty">{shift ? "Днес · "+local(shift.starts).slice(11)+" – "+local(shift.ends).slice(11) : "Без планирана смяна днес"}</p>
                      <footer className="staff-card-footer">
                        {data.owner && <button className="price" onClick={()=>salary(e.id)}>{salaryLabel(e.id)}</button>}
                        <button className="food-add-button" aria-label={"Отвори досието на "+e.name} onClick={()=>pick(e.id)}>+</button>
                      </footer>
                    </MenuCardFrame>
                  );})}
              </div>
              {!data.employees.some(
                (e) =>
                  e.active &&
                  (e.name + " " + e.position)
                    .toLocaleLowerCase("bg")
                    .includes(search.toLocaleLowerCase("bg")),
              ) && <p>Няма намерени активни служители.</p>}
              <details>
                <summary>Подробна справка и експорт</summary>
                <div className="sw-cards">
                  {cards.map(([label, value]) => (
                    <article key={label}>
                      <small>{label}</small>
                      <b>{value}</b>
                    </article>
                  ))}
                </div>
                <div className="sw-alerts">
                  <span>Непотвърдени отчети · {data.clock.pending}</span>
                  {data.owner && <span>Служители с остатък · {payable}</span>}
                  <span>
                    Предстоящи отпуски ·{" "}
                    {
                      data.leaves.filter(
                        (l) => l.status === "approved" && l.first_day > today(),
                      ).length
                    }
                  </span>
                </div>
                <div className="sw-tools">
                  <h3>Екип</h3>
                  <input
                    type="search"
                    placeholder="Име или длъжност"
                    aria-label="Търси служител"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    aria-label="Статус"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="active">Активни</option>
                    <option value="archived">Архивирани</option>
                    <option value="all">Всички</option>
                  </select>
                  <select
                    aria-label="Подредба"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="name">По име</option>
                    <option value="position">По длъжност</option>
                  </select>
                  {data.owner &&
                    (["CSV", "Excel"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() =>
                          (fmt === "Excel" ? excel : csv)("ekip-" + period, [
                            [
                              "Служител",
                              "Длъжност",
                              "Дни",
                              "Часове",
                              "Бонуси",
                              "Аванси",
                              "Остатък",
                            ],
                            ...rows.map((e) => {
                              const s = data.payroll.find(
                                (p) => p.id === e.id,
                              )?.slip;
                              return [
                                e.name,
                                e.position,
                                s?.days ?? 0,
                                s?.hours ?? 0,
                                s?.bonus ?? 0,
                                s?.advances ?? 0,
                                s?.remaining ?? 0,
                              ];
                            }),
                          ])
                        }
                      >
                        {fmt}
                      </button>
                    ))}
                </div>
                <div className="sw-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Служител",
                          "Длъжност",
                          "Статус",
                          ...(data.owner
                            ? [
                                "Дни",
                                "Часове",
                                "Дневна ставка",
                                "Месечна заплата",
                                "Бонуси",
                                "Аванси",
                                "Остатък¹",
                              ]
                            : []),
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => {
                        const entry = data.payroll.find((p) => p.id === e.id);
                        const s = entry?.slip;
                        return (
                          <tr key={e.id}>
                            <td>
                              <button onClick={() => pick(e.id)}>
                                {e.name}
                              </button>
                              {data.owner && (
                                <button
                                  className="sw-pay-action"
                                  onClick={() => salary(e.id)}
                                >
                                  {salaryLabel(e.id)}
                                </button>
                              )}
                            </td>
                            <td>{e.position}</td>
                            <td>
                              {!e.active
                                ? "Архивиран"
                                : data.leaves.some(
                                      (l) =>
                                        l.employee_id === e.id &&
                                        l.status === "approved" &&
                                        l.first_day <= today() &&
                                        l.last_day >= today(),
                                    )
                                  ? "Отсъства"
                                  : "Активен"}
                            </td>
                            {s &&
                              [
                                s.days,
                                s.hours,
                                entry?.mode === "day"
                                  ? money(Number(entry.rate))
                                  : "—",
                                entry?.mode === "month"
                                  ? money(Number(entry.rate))
                                  : "—",
                                money(s.bonus),
                                money(s.advances),
                                money(s.remaining),
                              ].map((v, i) => <td key={i}>{v}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!rows.length && <p>Няма служители за избрания филтър.</p>}
                {data.owner && (
                  <small>
                    ¹ За отворените периоди остатъкът е прогнозен. При
                    приключване се използва потвърденото нетно възнаграждение.
                  </small>
                )}
              </details>
            </>
          )}
          {tab === "calendar" && (
            <>
              <div>
                {data.owner && data.budget !== null && (
                  <p>
                    Прогнозен разход по график · {money(forecast(data))} от{" "}
                    {money(Number(data.budget))} бюджет
                  </p>
                )}
              </div>
              <Calendar
                data={data}
                period={period}
                setPeriod={setPeriod}
                edit={editShift}
                copy={(day) => {
                  if (
                    confirm(
                      "Копиране на графика за седмицата от " +
                        dateLabel(day) +
                        "?",
                    )
                  )
                    void mutate("copyWeek", { date: day });
                }}
                move={(s, day) => {
                  const a = local(s.starts),
                    b = local(s.ends),
                    offset = Math.round(
                      (Date.parse(b.slice(0, 10)) -
                        Date.parse(a.slice(0, 10))) /
                        86400000,
                    );
                  select(s.employee_id);
                  setTab("profile");
                  open("shift", {
                    id: s.id,
                    version: s.version,
                    start: day + a.slice(10),
                    end: addDays(day, offset) + b.slice(10),
                    pause: s.pause,
                    reason: "Преместване в графика",
                  });
                }}
              />
            </>
          )}
          {tab === "reports" && data.owner && (
            <>
              <PayAgenda
                key={period}
                data={data}
                period={period}
                reload={() => refresh((v) => v + 1)}
                pay={(emp) => {
                  pick(emp);
                  open("money", { kind: "payment" });
                }}
              />
              <details>
                <summary>Подробни финансови справки</summary>
                <Reports data={data} period={period} />
              </details>
            </>
          )}
          {tab === "profile" && (
            <>
              <div className="sw-tools">
                <label>
                  Служител
                  <select
                    value={id}
                    onChange={(e) => {
                      select(e.target.value);
                      if (spec) form(null);
                    }}
                  >
                    {data.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.position}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!selected ? (
                <p>Добави служител в регистъра, за да създадеш досие.</p>
              ) : !profile ? (
                <p>Зареждане на досието…</p>
              ) : (
                <>
                  {data.owner && !spec && (
                    <section className="staff-contact">
                      <Avatar
                        id={id}
                        name={selected.name}
                        available={!!selected.has_photo}
                      />
                      <div>
                        <h3>{selected.name}</h3>
                        <small>{selected.position}</small>
                        {profile.contact?.phone && (
                          <p>
                            Телефон ·{" "}
                            <a
                              href={
                                "tel:" +
                                profile.contact.phone.replace(/[^+0-9]/g, "")
                              }
                            >
                              {profile.contact.phone}
                            </a>
                          </p>
                        )}
                        {profile.contact?.address && (
                          <p>Адрес · {profile.contact.address}</p>
                        )}
                      </div>
                      <button onClick={() => open("personal")}>
                        Редактирай профила
                      </button>
                    </section>
                  )}
                  {spec?.action === "personal" ? (
                    <StaffPanel
                      key={id}
                      initialId={id}
                      onSalary={salary}
                      salaryLabel={salaryLabel}
                      onDone={() => {
                        form(null);
                        refresh((v) => v + 1);
                      }}
                    />
                  ) : spec ? (
                    <EntryForm
                      key={spec.action + String(spec.values?.id || "") + id}
                      spec={
                        spec.action === "salary"
                          ? salaryForm(profile, period)
                          : spec
                      }
                      period={period}
                      employee={selected.name}
                      busy={busy}
                      cancel={() => form(null)}
                      save={(v) =>
                        mutate(
                          spec.action === "salary" ? "contract" : spec.action,
                          v,
                        )
                      }
                    />
                  ) : (
                    <div className="sw-tools">
                      <button onClick={() => open("shift")}>
                        Добави смяна
                      </button>
                      {data.owner && (
                        <button onClick={() => open("salary")}>
                          {salaryLabel(id)}
                        </button>
                      )}
                      <details>
                        <summary>Други действия</summary>
                        <div className="sw-tools">
                          {[
                            "time",
                            "leave",
                            ...(data.owner
                              ? ["contract", "bonusRequest", "money", "close"]
                              : []),
                          ].map((a) => (
                            <button
                              key={a}
                              disabled={busy}
                              onClick={() => open(a)}
                            >
                              {titles[a]}
                            </button>
                          ))}
                        </div>
                      </details>
                      {profile.times?.find((t) => !t.ends) ? (
                        <button
                          onClick={() => {
                            const t = profile.times!.find((t) => !t.ends)!;
                            open("finish", {
                              id: t.id,
                              version: t.version,
                              reason: "Край на смяна",
                            });
                          }}
                        >
                          Край на смяна
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => mutate("start", {})}
                        >
                          Начало на смяна
                        </button>
                      )}
                    </div>
                  )}
                  {slip && (
                    <>
                      <h3>
                        {slip.closed
                          ? "Приключена ведомост"
                          : "Прогнозна ведомост"}
                      </h3>
                      <div className="sw-cards">
                        {[
                          ["Основа", money(slip.base)],
                          ["Брутно с доплащания", money(slip.gross)],
                          ["Удръжки", money(slip.deductions)],
                          [
                            "Нетно",
                            slip.net === null
                              ? "За потвърждение"
                              : money(slip.net),
                          ],
                          ["Изплатено", money(slip.payments + slip.advances)],
                          ["Остатък", money(slip.remaining)],
                        ].map(([k, v]) => (
                          <article key={k}>
                            <small>{k}</small>
                            <b>{v}</b>
                          </article>
                        ))}
                      </div>
                      {slip.missing > 0 && (
                        <p role="alert">
                          Дни с отчет без ставка · {slip.missing}
                        </p>
                      )}
                    </>
                  )}
                  {data.owner && !spec && (
                    <details>
                      <summary>Снимки на трудовия договор</summary>
                      <ContractPages
                        key={id}
                        id={id}
                        initial={profile.pages || []}
                      />
                    </details>
                  )}
                  <details>
                    <summary>Смени, присъствия и отпуски</summary>
                    <h3>Планирани смени</h3>
                    {profile.shifts?.map((s) => (
                      <p key={s.id}>
                        <button onClick={() => editShift(id, s)}>
                          {local(s.starts).replace("T", " ")} →{" "}
                          {local(s.ends).replace("T", " ")}
                        </button>{" "}
                        · почивка {s.pause} мин{" "}
                        <button
                          onClick={() =>
                            open("cancel", { id: s.id, version: s.version })
                          }
                        >
                          Отмени смяната
                        </button>
                      </p>
                    )) || <p>Няма смени.</p>}
                    <h3>Реално присъствие</h3>
                    {profile.times?.map((t) => (
                      <p key={t.id}>
                        {local(t.starts).replace("T", " ")} →{" "}
                        {t.ends
                          ? local(t.ends).replace("T", " ")
                          : "Отворена смяна"}{" "}
                        · {variance(t, profile.shifts || [])} ·{" "}
                        {t.confirmed ? "Потвърдено" : "За потвърждение"}{" "}
                        {t.ends && (
                          <button
                            onClick={() =>
                              open("time", {
                                id: t.id,
                                version: t.version,
                                start: local(t.starts),
                                end: local(t.ends!),
                                pause: t.pause,
                                confirmed: t.confirmed,
                              })
                            }
                          >
                            Корекция
                          </button>
                        )}
                      </p>
                    )) || <p>Няма отчети.</p>}
                    <h3>Отпуски и почивки</h3>
                    {profile.leaves?.map((l) => (
                      <p key={l.id}>
                        {kinds[l.kind]} · {dateLabel(l.first_day)} –{" "}
                        {dateLabel(l.last_day)} · {kinds[l.status]}{" "}
                        {l.status === "pending" &&
                          ["approved", "declined"].map((s) => (
                            <button
                              disabled={busy}
                              key={s}
                              onClick={() =>
                                mutate("decision", { id: l.id, status: s })
                              }
                            >
                              {s === "approved" ? "Одобри" : "Откажи"}
                            </button>
                          ))}
                      </p>
                    )) || <p>Няма отсъствия.</p>}
                  </details>
                  {data.owner && (
                    <>
                      <details>
                        <summary>Договори, бонуси и история</summary>
                        <h3>Договори и ставки</h3>
                        {profile.contracts?.map((c) => (
                          <p key={c.effective}>
                            {c.effective} · {c.employment} · {c.hours} ч/седм. ·{" "}
                            {modes[c.mode]} · {money(c.rate)}
                          </p>
                        )) || <p>Няма договорена ставка.</p>}
                        <h3>Предложени бонуси</h3>
                        {profile.bonuses?.map((b) => (
                          <p key={b.id}>
                            {b.booked} · {b.reason} · {money(b.amount)} ·{" "}
                            {kinds[b.status]} · {b.decided_by || b.actor}{" "}
                            {b.status === "pending" &&
                              ["approved", "declined"].map((s) => (
                                <button
                                  key={s}
                                  disabled={busy}
                                  onClick={() =>
                                    mutate("bonusDecision", {
                                      id: b.id,
                                      status: s,
                                    })
                                  }
                                >
                                  {s === "approved" ? "Одобри" : "Откажи"}
                                </button>
                              ))}
                          </p>
                        )) || <p>Няма предложения.</p>}
                        <h3>Бонуси, корекции и плащания</h3>
                        {profile.amounts?.map((a) => (
                          <p key={a.id}>
                            {a.booked} · {kinds[a.kind]} · {money(a.amount)} ·{" "}
                            {a.reason} {a.method && " · " + kinds[a.method]} ·{" "}
                            {a.actor}
                          </p>
                        )) || <p>Няма финансови записи.</p>}
                        <details>
                          <summary>История на операциите</summary>
                          {profile.history?.map((h, i) => (
                            <p key={i}>
                              {local(h.changed_at).replace("T", " ")} ·{" "}
                              {titles[h.action]} · {h.actor}{" "}
                              {h.payload.reason
                                ? " · " + String(h.payload.reason)
                                : ""}
                            </p>
                          )) || <p>Няма операции.</p>}
                        </details>
                      </details>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
