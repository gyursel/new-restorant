"use client";
import { useEffect, useState, type FormEvent } from "react";

import { ContractPages, readImage, acceptImages } from "./staff/StaffPhotos";
import { request } from "./staff/model";
type Employee = {
  id: string;
  version: number;
  name: string;
  position: string;
  hired_on: string;
  active: boolean;
  notes?: string;
  phone?: string;
  address?: string;
  photo?: string;
};

export default function StaffPanel({
  onSalary,
  salaryLabel,
  initialId,
  onDone,
}: {
  onSalary: (id: string) => void;
  salaryLabel: (id: string) => string;
  initialId?: string;
  onDone?: () => void;
}) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [draft, setDraft] = useState<Employee | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [revision, refresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<number[]>([]),
    [reading, setReading] = useState(false);
  async function edit(id: string) {
    setLoading(true);
    setError("");
    try {
      const r = await request<{ employee: Employee; pages: number[] }>(
        "/api/admin/staff?id=" + id,
      );
      setDraft(r.employee);
      setPages(r.pages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (initialId) void edit(initialId);
  }, [initialId]);
  useEffect(() => {
    if (initialId) return;
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
  }, [query, page, revision, initialId]);

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
      if (draft.version === 0) {
        await edit(draft.id);
        refresh((v) => v + 1);
        return;
      }
      if (onDone) onDone();
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
          <fieldset disabled={saving || reading}>
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
              Телефон за връзка
              <input
                type="tel"
                maxLength={48}
                value={draft.phone || ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </label>
            <label>
              Адрес за връзка
              <input
                maxLength={350}
                value={draft.address || ""}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
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
              Портрет · до 1 MB
              <input
                type="file"
                accept={acceptImages}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setReading(true);
                  try {
                    const image = await readImage(f, 1048576);
                    setDraft((prev) =>
                      prev && prev.id === draft.id
                        ? { ...prev, photo: image }
                        : prev,
                    );
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setReading(false);
                  }
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
              onClick={() => (onDone ? onDone() : setDraft(null))}
            >
              Назад
            </button>
          </fieldset>
          {draft.version > 0 && (
            <ContractPages key={draft.id} id={draft.id} initial={pages} />
          )}
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
                    <th>Статус</th>
                    <th>Възнаграждение</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Служител">
                        <button
                          className="cms-btn"
                          onClick={() => void edit(e.id)}
                        >
                          {e.name}
                        </button>
                      </td>
                      <td data-label="Длъжност">{e.position}</td>
                      <td data-label="Назначен на">{e.hired_on.split("-").reverse().join(".")}</td>
                      <td data-label="Статус">{e.active ? "Активен" : "Архивиран"}</td>
                      <td data-label="Възнаграждение">
                        <button
                          className="cms-btn"
                          onClick={() => onSalary(e.id)}
                        >
                          {salaryLabel(e.id)}
                        </button>
                      </td>
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
