import { build } from "esbuild";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, "../.."),
  out = path.join(root, "public/staff-review"),
  engine = path.join(here, "node_modules/@electric-sql/pglite/dist");
await mkdir(path.join(out, "engine"), { recursive: true });
for (const name of await readdir(engine))
  if (
    /^(chunk-.*\.js|index\.js|pglite\.(js|data|wasm)|initdb\.(js|wasm))$/.test(
      name,
    )
  )
    await copyFile(path.join(engine, name), path.join(out, "engine", name));
const files = (await readdir(path.join(root, "database")))
  .filter((f) => /^staff-\d+\.sql$/.test(f))
  .sort()
  .map((f) => path.join(root, "database", f));
await writeFile(
  path.join(out, "schema.sql"),
  (
    await Promise.all(
      [...files, path.join(here, "seed.sql")].map((f) => readFile(f, "utf8")),
    )
  ).join("\n"),
);
await build({
  entryPoints: [path.join(here, "review.jsx")],
  outfile: path.join(out, "review.js"),
  bundle: true,
  minify: true,
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["./engine/index.js"],
  plugins: [
    {
      name: "browser-review",
      setup(b) {
        b.onResolve({ filter: /server\/(auth|cms)$/ }, () => ({
          path: path.join(here, "adapter.js"),
        }));
      },
    },
  ],
});
await writeFile(
  path.join(out, "index.html"),
  `<!doctype html><html lang="bg"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Персонал | CHEF’S BURGER</title><link rel="stylesheet" href="./review.css"><style>*{box-sizing:border-box}body{margin:0;background:#090b0c;color:#f5f0e8;font:15px system-ui}main{max-width:1440px;padding:clamp(12px,3vw,44px);margin:auto}aside{color:#dbcdbc;margin-bottom:12px}button{cursor:pointer}</style><main><aside>Преглед за одобрение · Примерни служители · Промените се пазят в този браузър.</aside><div id="root">Зареждане на примерния екип…</div></main><script type="module" src="./review.js"></script></html>`,
);
