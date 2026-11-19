import React from "react";
import { createRoot } from "react-dom/client";
import StaffWorkspace from "../../app/admin/StaffWorkspace";
import "../../app/admin/staff.css";
import * as staff from "../../app/api/admin/staff/route";
import * as workspace from "../../app/api/admin/staff/workspace/route";
async function main() {
  const { PGlite } = await import("./engine/index.js");
  window.staffDatabase = new PGlite("idb://chef-staff-review-v1");
  await window.staffDatabase.exec(await (await fetch("./schema.sql")).text());
  const original = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const pathname = new URL(url, location.href).pathname;
    if (!["/api/admin/staff", "/api/admin/staff/workspace"].includes(pathname))
      return original(url, options);
    const route = pathname.endsWith("workspace") ? workspace : staff;
    const response = await route[options.method || "GET"](
      new Request(new URL(url, location.href), options),
    );
    options.signal?.throwIfAborted();
    return response;
  };
  createRoot(document.getElementById("root")).render(<StaffWorkspace />);
}
main().catch((err) => {
  document.getElementById("root").textContent =
    "Прегледът не се зареди. " + err.message;
});
