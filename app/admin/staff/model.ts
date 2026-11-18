export type Employee = {
  has_photo?: boolean;
  id: string;
  name: string;
  position: string;
  active: boolean;
};
export type Shift = {
  id: string;
  employee_id: string;
  starts: string;
  ends: string;
  pause: number;
  version: number;
};
export type Time = Omit<Shift, "ends"> & {
  ends: string | null;
  confirmed: boolean;
};
export type Leave = {
  id: string;
  employee_id: string;
  first_day: string;
  last_day: string;
  kind: string;
  status: string;
};
export type Slip = {
  days: number;
  hours: number;
  gross: number;
  deductions: number;
  base: number;
  extra: number;
  bonus: number;
  payments: number;
  advances: number;
  remaining: number;
  net: number | null;
  closed: boolean;
  missing: number;
};
export type Dashboard = {
  budget: number | string | null;
  warnings: {
    employee_id: string;
    work_day: string;
    kind: string;
    hours: number;
    minimum: number;
  }[];
  employees: Employee[];
  shifts: Shift[];
  leaves: Leave[];
  clock: {
    hours: number;
    week_hours: number;
    working: number;
    pending: number;
    today: number;
    absent: number;
  };
  payroll: {
    id: string;
    slip: Slip;
    due?: string;
    planned?: number | string;
    mode?: string;
    rate?: number;
  }[];
  owner: boolean;
};
export type Profile = {
  contact?: { phone: string; address: string };
  pages?: number[];
  shifts: Shift[] | null;
  times: Time[] | null;
  leaves: Leave[] | null;
  slip?: Slip;
  contracts?: {
    effective: string;
    rate: number;
    mode: string;
    hours: number;
    employment: string;
    rest_hours: number;
    weekly_rest: number;
  }[];
  bonuses?: {
    id: string;
    booked: string;
    amount: number;
    reason: string;
    actor: string;
    status: string;
    decided_by: string | null;
  }[];
  amounts?: {
    id: string;
    booked: string;
    kind: string;
    amount: number;
    reason: string;
    method: string;
    actor: string;
  }[];
  history?: {
    changed_at: string;
    actor: string;
    action: string;
    payload: Record<string, unknown>;
  }[];
};
export const modes: Record<string, string> = {
  hour: "Почасово",
  day: "На ден",
  month: "Месечно",
};
export const kinds: Record<string, string> = {
  paid: "Платен отпуск",
  unpaid: "Неплатен отпуск",
  sick: "Болничен",
  other: "Друго отсъствие",
  rest: "Седмична почивка",
  pending: "За одобрение",
  approved: "Одобрено",
  declined: "Отказано",
  bonus: "Бонус",
  deduction: "Удръжка",
  night: "Нощен труд",
  overtime: "Допълнителен труд",
  holiday: "Празничен труд",
  advance: "Аванс",
  payment: "Плащане",
  cash: "В брой",
  bank: "Банка",
};
export const money = (v: number) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(
    v,
  );
export const local = (v: string | Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(v))
    .replace(" ", "T");
export const today = () => local(new Date()).slice(0, 10);
export const dateLabel = (v: string) =>
  new Date(v.slice(0, 10) + "T12:00Z").toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monday(day: string) {
  return addDays(day, -((new Date(day + "T12:00Z").getUTCDay() + 6) % 7));
}
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json();
  if (!res.ok) throw new Error([data.error, ...(data.details || [])].join(" "));
  return data;
}
export function csv(name: string, rows: (string | number)[][]) {
  const quote = (v: string | number) =>
    '"' +
    String(v)
      .replace(/^[=+@\-\t\r]/, (m) => "'" + m)
      .replaceAll('"', '""') +
    '"';
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(quote).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  link.download = name + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
export function excel(name: string, rows: (string | number)[][]) {
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const table = rows
    .map(
      (row) =>
        "<Row>" +
        row
          .map(
            (v) =>
              '<Cell><Data ss:Type="' +
              (typeof v === "number" ? "Number" : "String") +
              '">' +
              escape(String(v)) +
              "</Data></Cell>",
          )
          .join("") +
        "</Row>",
    )
    .join("");
  const xml =
    '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Персонал"><Table>' +
    table +
    "</Table></Worksheet></Workbook>";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  link.download = name + ".xml";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
