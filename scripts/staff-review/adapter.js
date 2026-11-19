// Only linked into the isolated review build. All data belongs to this browser.
export const staffIdentity = async () => ({ email: "preview", owner: true });
export const authorize = async () => "preview";
export const sameOrigin = () => {};
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const json = (data, status = 200) => Response.json(data, { status });
export const failure = (e) => json({ error: e.message }, e.status || 400);
class Query {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
  }
  compile(params) {
    return this.strings.reduce((sql, s, i) => {
      if (i === 0) return s;
      const v = this.values[i - 1];
      return (
        sql +
        (v instanceof Query ? v.compile(params) : "$" + params.push(v)) +
        s
      );
    }, "");
  }
  async run() {
    const args = [];
    const sql = this.compile(args);
    return (await window.staffDatabase.query(sql, args)).rows;
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
}
export const db =
  () =>
  (strings, ...values) =>
    new Query(strings, values);
