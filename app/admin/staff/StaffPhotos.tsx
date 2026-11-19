import { useEffect, useRef, useState } from "react";
import { request } from "./model";
export const acceptImages = "image/jpeg,image/png,image/webp";
export async function readImage(file: File, max: number) {
  if (!acceptImages.split(",").includes(file.type) || file.size > max)
    throw new Error("Избери JPG, PNG или WebP до " + max / 1048576 + " MB.");
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Снимката не може да се прочете."));
    r.readAsDataURL(file);
  });
}
export function Avatar({
  id,
  name,
  available,
}: {
  id: string;
  name: string;
  available: boolean;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState("");
  useEffect(() => {
    setSrc("");
    if (!available) return;
    const c = new AbortController();
    function load() {
      request<{ photo: string }>("/api/admin/staff?id=" + id + "&portrait=1", {
      signal: c.signal,
    })
      .then((r) => {
        if (!c.signal.aborted) setSrc(r.photo);
      })
      .catch(() => {});
    }
    const target=element.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      load();
      return () => c.abort();
    }
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}
    },{rootMargin:"200px"});
    observer.observe(target);
    return () => {observer.disconnect();c.abort();};
  }, [id, available]);
  return (
    <span ref={element} className="staff-avatar" aria-hidden="true">
      {src ? (
        <img src={src} alt="" />
      ) : (
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0])
          .join("")
      )}
    </span>
  );
}
export function ContractPages({
  id,
  initial,
}: {
  id: string;
  initial: number[];
}) {
  const [pages, setPages] = useState(initial),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(files: File[]) {
    if (!files.length) return;
    setError("");
    setBusy(true);
    const slots = [1, 2, 3, 4, 5, 6].filter((n) => !pages.includes(n));
    try {
      if (files.length > slots.length)
        throw new Error("Свободни места: " + slots.length + ".");
      const images = await Promise.all(files.map((f) => readImage(f, 2097152)));
      for (const [i, image] of images.entries()) {
        await request("/api/admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "contractPhoto",
            id,
            slot: slots[i],
            image,
          }),
        });
        setPages((p) => [...p, slots[i]].sort((a, b) => a - b));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="contract-pages">
      <h3>Трудов договор</h3>
      <div className="sw-tools">
        {pages.map((slot) => (
          <button
            type="button"
            key={slot}
            disabled={busy}
            onClick={async () => {
              try {
                setError("");
                setBusy(true);
                setPreview(
                  (
                    await request<{ image: string }>(
                      "/api/admin/staff?id=" + id + "&slot=" + slot,
                    )
                  ).image,
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Страница {slot}
          </button>
        ))}
      </div>
      {pages.length < 6 && (
        <label>
          Добави снимки · {pages.length}/6 · до 2 MB всяка
          <input
            disabled={busy}
            type="file"
            accept={acceptImages}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              void upload(files);
            }}
          />
        </label>
      )}
      {busy && <p role="status">Зареждане…</p>}
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div>
          <button type="button" onClick={() => setPreview("")}>
            Затвори снимката
          </button>
          <img
            src={preview}
            alt="Страница от трудовия договор"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      )}
    </section>
  );
}
