import { money, type Slip } from "./model";

// A single A4 page. Render Cyrillic with the browser font and embed its JPEG in the PDF.
export function downloadSlip(name: string, period: string, s: Slip) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF файлът не можа да бъде създаден.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 1240, 1754);
  ctx.fillStyle = "#222";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("CHEF’S BURGER", 90, 120);
  ctx.font = "bold 50px sans-serif";
  ctx.fillText(s.closed ? "Фиш за възнаграждение" : "Прогнозен фиш", 90, 235);
  ctx.font = "32px sans-serif";
  ctx.fillText(name, 90, 315, 1030);
  ctx.fillText(period, 90, 370);
  const rows = [
    ["Работни дни / часове", s.days + " / " + s.hours],
    ["Основно възнаграждение", money(s.base)],
    ["Бонуси", money(s.bonus)],
    ["Доплащания", money(s.extra)],
    ["Брутно", money(s.gross)],
    ["Удръжки", money(s.deductions)],
    [
      "Потвърдено нетно",
      s.net === null ? "Предстои потвърждение" : money(s.net),
    ],
    ["Аванси", money(s.advances)],
    ["Други плащания", money(s.payments)],
    [s.closed ? "Остатък" : "Прогнозен остатък", money(s.remaining)],
  ];
  rows.forEach(([k, v], i) => {
    const y = 495 + i * 85;
    ctx.fillStyle = "#222";
    ctx.textAlign = "left";
    ctx.fillText(k, 90, y);
    ctx.textAlign = "right";
    ctx.fillText(v, 1150, y);
    ctx.fillStyle = "#ddd";
    ctx.fillRect(90, y + 23, 1060, 2);
  });
  const jpeg = Uint8Array.from(
    atob(canvas.toDataURL("image/jpeg", 0.93).split(",")[1]),
    (c) => c.charCodeAt(0),
  );
  const chunks: BlobPart[] = [],
    offsets = [0];
  let bytes = 0;
  function append(s: string) {
    const v = new TextEncoder().encode(s);
    chunks.push(v);
    bytes += v.length;
  }
  function object(id: number, body: string) {
    offsets[id] = bytes;
    append(id + " 0 obj\n" + body + "\nendobj\n");
  }
  append("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Sheet 4 0 R >> >> /Contents 5 0 R >>",
  );
  offsets[4] = bytes;
  append(
    "4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      jpeg.length +
      " >>\nstream\n",
  );
  chunks.push(jpeg);
  bytes += jpeg.length;
  append("\nendstream\nendobj\n");
  const stream = "q 595 0 0 842 0 0 cm /Sheet Do Q\n";
  object(
    5,
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream",
  );
  const xref = bytes;
  append(
    "xref\n0 6\n0000000000 65535 f \n" +
      offsets
        .slice(1)
        .map((v) => String(v).padStart(10, "0") + " 00000 n \n")
        .join("") +
      "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF",
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(chunks, { type: "application/pdf" }),
  );
  link.download = "Фиш-" + name + "-" + period + ".pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
