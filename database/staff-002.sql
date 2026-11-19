BEGIN;
ALTER TABLE staff_employees ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
ALTER TABLE staff_employees ADD COLUMN IF NOT EXISTS photo text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS staff_inactive_periods (
 employee_id uuid NOT NULL REFERENCES staff_employees, since date NOT NULL, until_day date,
 CHECK(until_day IS NULL OR until_day>=since), PRIMARY KEY(employee_id,since)
);
INSERT INTO staff_inactive_periods(employee_id,since) SELECT id,(now() AT TIME ZONE 'Europe/Sofia')::date
 FROM staff_employees WHERE NOT active AND NOT EXISTS(SELECT 1 FROM staff_inactive_periods p WHERE p.employee_id=staff_employees.id AND p.until_day IS NULL)
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS staff_contracts (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees, effective date NOT NULL,
 mode text NOT NULL CHECK(mode IN ('hour','day','month')), rate numeric(12,2) NOT NULL CHECK(rate>=0),
 hours numeric(5,2) NOT NULL CHECK(hours>0 AND hours<=168), employment text NOT NULL,
 rest_hours numeric(5,2) NOT NULL CHECK(rest_hours>=0), weekly_rest numeric(5,2) NOT NULL CHECK(weekly_rest>=0),
 UNIQUE(employee_id,effective)
);
CREATE TABLE IF NOT EXISTS staff_shifts (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees,
 starts timestamptz NOT NULL, ends timestamptz NOT NULL, pause integer NOT NULL DEFAULT 0,
 version integer NOT NULL DEFAULT 1, CHECK(ends>starts AND ends-starts<=interval '24 hours'),
 CHECK(pause>=0 AND pause*interval '1 minute'<ends-starts)
);
CREATE INDEX IF NOT EXISTS staff_shift_lookup ON staff_shifts(employee_id,starts);
CREATE TABLE IF NOT EXISTS staff_time_entries (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees,
 starts timestamptz NOT NULL, ends timestamptz, pause integer NOT NULL DEFAULT 0,
 confirmed boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 CHECK(ends IS NULL OR (ends>starts AND ends-starts<=interval '24 hours')),
 CHECK(pause>=0 AND (ends IS NULL OR pause*interval '1 minute'<ends-starts)), CHECK(NOT confirmed OR ends IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS staff_time_lookup ON staff_time_entries(employee_id,starts);
CREATE UNIQUE INDEX IF NOT EXISTS staff_open_time ON staff_time_entries(employee_id) WHERE ends IS NULL;
CREATE TABLE IF NOT EXISTS staff_leave_requests (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees,
 first_day date NOT NULL, last_day date NOT NULL CHECK(last_day>=first_day), kind text NOT NULL
 CHECK(kind IN ('paid','unpaid','sick','other','rest')), status text NOT NULL CHECK(status IN ('pending','approved','declined'))
);
CREATE INDEX IF NOT EXISTS staff_leave_lookup ON staff_leave_requests(employee_id,first_day);
CREATE TABLE IF NOT EXISTS staff_amounts (
 id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees,
 period date NOT NULL CHECK(extract(day from period)=1), booked date NOT NULL,
 kind text NOT NULL CHECK(kind IN ('bonus','deduction','overtime','night','holiday','advance','payment')),
 amount numeric(12,2) NOT NULL CHECK(amount>0), reason text NOT NULL,
 method text CHECK(method IN ('cash','bank')), actor text NOT NULL,
 CHECK((kind IN ('advance','payment'))=(method IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS staff_bonus_requests(
 id uuid PRIMARY KEY,employee_id uuid NOT NULL REFERENCES staff_employees,period date NOT NULL CHECK(extract(day from period)=1),
 booked date NOT NULL,amount numeric(12,2) NOT NULL CHECK(amount>0),reason text NOT NULL,actor text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),decided_by text,decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS staff_bonus_period ON staff_bonus_requests(employee_id,period);
CREATE INDEX IF NOT EXISTS staff_amount_lookup ON staff_amounts(period,employee_id);
CREATE TABLE IF NOT EXISTS staff_payroll_entries (
 employee_id uuid NOT NULL REFERENCES staff_employees, period date NOT NULL CHECK(extract(day from period)=1),
 snapshot jsonb NOT NULL, net numeric(12,2) NOT NULL CHECK(net>=0), closed_by text NOT NULL,
 closed_at timestamptz NOT NULL DEFAULT now(), rule_version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(employee_id,period)
);
CREATE TABLE IF NOT EXISTS staff_audit_log (
 request_id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES staff_employees,
 action text NOT NULL, actor text NOT NULL, payload jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_audit_lookup ON staff_audit_log(employee_id,changed_at DESC);
CREATE OR REPLACE FUNCTION staff_day(timestamptz) RETURNS date LANGUAGE sql STABLE AS
$$ SELECT ($1 AT TIME ZONE 'Europe/Sofia')::date $$;
-- Attendance belongs to the business day on which the shift starts. Effective rates are picked per day.
CREATE OR REPLACE FUNCTION staff_daily(emp uuid,m date) RETURNS TABLE(d date,mode text,rate numeric,minutes numeric) LANGUAGE sql STABLE AS $$
 WITH dates AS (
 SELECT m+i AS d FROM generate_series(0,((m+interval '1 month')::date-m)-1) AS i
 )
 SELECT d,c.mode,c.rate,t.minutes FROM dates
 JOIN staff_employees e ON e.id=emp AND e.hired_on<=d
 AND NOT EXISTS(SELECT 1 FROM staff_inactive_periods p WHERE p.employee_id=e.id AND p.since<=d AND (p.until_day IS NULL OR d<p.until_day))
 LEFT JOIN LATERAL (SELECT mode,rate FROM staff_contracts WHERE employee_id=emp AND effective<=d ORDER BY effective DESC LIMIT 1)c ON true
 LEFT JOIN LATERAL (SELECT sum(extract(epoch FROM ends-starts)/60-pause) AS minutes FROM staff_time_entries
 WHERE employee_id=emp AND confirmed AND starts >= (d::timestamp AT TIME ZONE 'Europe/Sofia')
 AND starts < ((d+1)::timestamp AT TIME ZONE 'Europe/Sofia'))t ON true
 $$;
CREATE OR REPLACE FUNCTION staff_statement(emp uuid, m date) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH daily AS (SELECT * FROM staff_daily(emp,m) ), totals AS (
 SELECT count(minutes) AS days,round(coalesce(sum(minutes),0)/60,2) AS hours,
 round(coalesce(sum(CASE mode WHEN 'month' THEN rate/((m+interval '1 month')::date-m)
 WHEN 'day' THEN CASE WHEN minutes>0 THEN rate ELSE 0 END WHEN 'hour' THEN minutes*rate/60 END),0),2) AS base,
 count(*) FILTER(WHERE minutes>0 AND rate IS NULL) AS missing FROM daily
 ), amounts AS (
 SELECT coalesce(sum(amount) FILTER(WHERE kind='bonus'),0) bonus,
 coalesce(sum(amount) FILTER(WHERE kind IN ('overtime','night','holiday')),0) extra,
 coalesce(sum(amount) FILTER(WHERE kind='deduction'),0) deductions,
 coalesce(sum(amount) FILTER(WHERE kind='advance'),0) advances,
 coalesce(sum(amount) FILTER(WHERE kind='payment'),0) payments FROM staff_amounts WHERE employee_id=emp AND period=m
 ), calculation AS (
 SELECT days,hours,base,missing,bonus,extra,deductions,base+bonus+extra AS gross FROM totals,amounts
 ), statement AS (
 SELECT coalesce(p.snapshot,to_jsonb(c)) AS calc,p.net,p.closed_at,a.advances,a.payments
 FROM calculation c CROSS JOIN amounts a LEFT JOIN staff_payroll_entries p ON p.employee_id=emp AND p.period=m
 )
 SELECT calc || jsonb_build_object('net',net,'closed',closed_at IS NOT NULL,'advances',advances,'payments',payments,
 'remaining',coalesce(net,(calc->>'gross')::numeric-(calc->>'deductions')::numeric)-advances-payments) FROM statement
$$;
COMMIT;
