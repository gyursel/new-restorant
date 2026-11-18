import { build } from "esbuild";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const require = createRequire(import.meta.url),
  root = new URL("../../", import.meta.url);
const pg = new PGlite(),
  database = new URL("database/", root);
for (const f of (await readdir(database))
  .filter((s) => /^staff-\d+\.sql$/.test(s))
  .sort())
  await pg.exec(await readFile(new URL(f, database), "utf8"));
global.window = { staffDatabase: pg };
process.env.ADMIN_EMAIL = "owner@example.test";
process.env.SESSION_SECRET = "A".repeat(64);
process.env.STAFF_MANAGER_EMAIL = "manager@example.test";
process.env.STAFF_MANAGER_PASSWORD_HASH = "configured-for-session-test";
const code = await build({
  stdin: {
    contents:
      "export * as auth from './server/auth'; export * as register from './app/api/admin/staff/route'; export * as workspace from './app/api/admin/staff/workspace/route';",
    resolveDir: root.pathname,
  },
  platform: "node",
  format: "cjs",
  bundle: true,
  write: false,
  plugins: [
    {
      name: "test-database-and-cookie-store",
      setup(b) {
        b.onResolve({ filter: /next\/headers$/ }, () => ({
          path: "cookies",
          namespace: "qa",
        }));
        b.onResolve({ filter: /(server\/cms|^\.\/cms)$/ }, () => ({
          path: "cms",
          namespace: "qa",
        }));
        b.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
          contents:
            path === "cookies"
              ? "export const cookies=async()=>({get:()=>({value:globalThis.staffTestCookie})});"
              : "export {authorize,sameOrigin,HttpError,json,failure} from './server/cms.ts';export {db} from './scripts/staff-review/adapter.js';",
          resolveDir: root.pathname,
        }));
      },
    },
  ],
});
const module = { exports: {} };
new Function("module", "exports", "require", code.outputFiles[0].text)(
  module,
  module.exports,
  require,
);
const { auth, register, workspace } = module.exports;
global.staffTestAuth = auth;
const endpoint = "https://staff.example.test",
  emp = crypto.randomUUID();
const get = (route, path = "?period=2024-01-01") =>
  route.GET(new Request(endpoint + "/" + path));
const post = (route, body, origin = endpoint) =>
  route.POST(
    new Request(endpoint, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    }),
  );
assert.equal((await get(workspace)).status, 401);
global.staffTestCookie = auth.createSession("owner@example.test");
let e = {
  id: emp,
  name: "Елица Димова",
  position: "Касиер",
  hired_on: "2024-01-01",
  active: true,
  version: 0,
};
assert.equal((await post(register, e)).status, 200);
e = { ...e, version: 1, name: "Елица Димитрова" };
assert.equal((await post(register, e)).status, 200);
assert.equal((await post(register, e)).status, 409);
assert.equal(
  (await post(register, e, "https://other.example.test")).status,
  403,
);
const dashboard = await (await get(workspace)).json();
assert.equal(dashboard.owner, true);
assert.equal(dashboard.employees.length, 1);
const trends = await (
  await get(workspace, "?period=2024-01-01&view=trends")
).json();
assert.ok(Array.isArray(trends.months), JSON.stringify(trends));
global.staffTestCookie = auth.createSession("manager@example.test");
assert.equal(await auth.getAdmin(), null);
assert.equal((await get(register)).status, 401);
const manager = await (await get(workspace)).json();
assert.equal(manager.owner, false);
assert.deepEqual(manager.payroll, []);
const profile = await (
  await get(workspace, "?period=2024-01-01&employee=" + emp)
).json();
for (const key of ["slip", "contracts", "amounts", "history", "notes"])
  assert.equal(key in profile, false);
assert.equal(
  (await get(workspace, "?period=2024-01-01&view=trends")).status,
  403,
);
assert.equal(
  (
    await post(workspace, {
      employee: emp,
      request: crypto.randomUUID(),
      action: "money",
      data: {},
    })
  ).status,
  403,
);
assert.equal(
  (
    await post(workspace, {
      employee: emp,
      request: crypto.randomUUID(),
      action: "shift",
      data: {
        start: "2024-01-02T12:00",
        end: "2024-01-02T17:00",
        pause: 15,
        repeat: 1,
      },
    })
  ).status,
  200,
);
global.staffTestCookie = auth.createSession("unknown@example.test");
assert.equal((await get(workspace)).status, 403);
await pg.close();
console.log(
  "PASS real signed sessions, owner CRUD and stale edit, manager operations, private profile and reports, anonymous access and cross-origin writes",
);
