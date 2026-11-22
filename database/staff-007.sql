BEGIN;
ALTER TABLE staff_employees ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE staff_employees ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS staff_contract_photos(
 employee_id uuid NOT NULL REFERENCES staff_employees(id), slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 6),
 image text NOT NULL,actor text NOT NULL,uploaded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(employee_id,slot)
);
COMMIT;
