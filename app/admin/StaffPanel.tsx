"use client";
import { useEffect, useState, type FormEvent } from "react";

type Employee = {
  id: string;
  version: number;
  name: string;
  position: string;
  hired_on: string;
  active: boolean;
  notes?: string;
  photo?: string;
};

export default function StaffPanel({onSalary}: {onSalary:(id:string)=>void}) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [draft, setDraft] = useState<Employee | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [revision, refresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          "/api/admin/staff?" +
            new URLSearchParams({ q: query, page: String(page) }),
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(data.employees);
        setMore(data.more);
      } catch (err) {
        if (!controller.signal.aborted) {
          setRows([]);
          setMore(false);
          setError(String((err as Error).message));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    if (
      !draft.active &&
      rows.find((e) => e.id === draft.id)?.active &&
      !window.confirm("Архивиране на служителя?")
    )
      return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDraft(null);
      refresh((v) => v + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="staff-register">
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="cms-btn" onClick={() => refresh((v) => v + 1)}>
            Презареди
          </button>
        </p>
      )}
      {draft ? (
        <form onSubmit={save}>
          <h2>{draft.version ? "Профил на служителя" : "Нов служител"}</h2>
          <fieldset disabled={saving}>
            <label>
              Име и фамилия
              <input
                required
                minLength={2}
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Длъжност
              <input
                required
                minLength={2}
                maxLength={80}
                value={draft.position}
                onChange={(e) =>
                  setDraft({ ...draft, position: e.target.value })
                }
              />
            </label>
            <label>
              Дата на назначаване
              <input
                type="date"
                required
                value={draft.hired_on}
                onChange={(e) =>
                  setDraft({ ...draft, hired_on: e.target.value })
                }
              />
            </label>
            <label>
              Служебни бележки (само собственик)
              <textarea
                maxLength={1000}
                value={draft.notes || ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <label>
              Снимка · JPG, PNG или WebP до 128 KB
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    f.size > 131072 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(f.type)
                  ) {
                    setError("Избери снимка до 128 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () =>
                    setDraft((prev) =>
                      prev && prev.id === draft.id
                        ? { ...prev, photo: String(reader.result) }
                        : prev,
                    );
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            {draft.photo && (
              <div>
                <img
                  alt={draft.name}
                  width={56}
                  height={56}
                  src={draft.photo}
                />
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, photo: "" })}
                >
                  Премахни снимката
                </button>
              </div>
            )}
            <label>
              Статус
              <select
                value={String(draft.active)}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.value === "true" })
                }
              >
                <option value="true">Активен</option>
                <option value="false">Архивиран</option>
              </select>
            </label>
            <button className="cms-btn primary">
              {saving ? "Записване…" : "Запази"}
            </button>
            <button
              type="button"
              className="cms-btn"
              onClick={() => setDraft(null)}
            >
              Назад
            </button>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="staff-toolbar">
            <label>
              Търсене по име или длъжност
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
              />
            </label>
            <button
              className="cms-btn primary"
              onClick={() =>
                setDraft({
                  id: crypto.randomUUID(),
                  version: 0,
                  name: "",
                  position: "",
                  hired_on: "",
                  active: true,
                })
              }
            >
              Добави служител
            </button>
          </div>
          {loading ? (
            <p role="status">Зареждане…</p>
          ) : rows.length ? (
            <div className="staff-table">
              <table>
                <thead>
                  <tr>
                    <th>Служител</th>
                    <th>Длъжност</th>
                    <th>Назначен на</th>
                    <th>Статус</th><th>Възнаграждение</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <button className="cms-btn" onClick={() => setDraft(e)}>
                          {e.name}
                        </button>
                      </td>
                      <td>{e.position}</td>
                      <td>{e.hired_on.split("-").reverse().join(".")}</td>
                      <td>{e.active ? "Активен" : "Архивиран"}</td><td><button className="cms-btn" onClick={()=>onSalary(e.id)}>Въведи заплата</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !error && (
              <p>{query ? "Няма съвпадения." : "Няма добавени служители."}</p>
            )
          )}
          {(page > 1 || more) && (
            <div className="staff-toolbar">
              <button
                className="cms-btn"
                disabled={loading || page === 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </button>
              Страница {page}
              <button
                className="cms-btn"
                disabled={loading || !more}
                onClick={() => setPage(page + 1)}
              >
                Напред
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
