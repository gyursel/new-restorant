BEGIN;
CREATE TABLE IF NOT EXISTS staff_employees (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  position text NOT NULL CHECK (length(trim(position)) BETWEEN 2 AND 80),
  hired_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS staff_employee_name_idx ON staff_employees (name, id);
CREATE TABLE IF NOT EXISTS staff_employee_audit (
  employee_id uuid NOT NULL REFERENCES staff_employees(id),
  version integer NOT NULL,
  actor text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  PRIMARY KEY (employee_id, version)
);
COMMIT;
