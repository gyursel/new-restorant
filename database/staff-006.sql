BEGIN;
CREATE TABLE IF NOT EXISTS staff_month_budgets (
 period date PRIMARY KEY CHECK(extract(day from period)=1),
 amount numeric(12,2) NOT NULL CHECK(amount>=0),actor text NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_pay_dates (
 employee_id uuid NOT NULL REFERENCES staff_employees,
 period date NOT NULL CHECK(extract(day from period)=1),
 due date NOT NULL, actor text NOT NULL,PRIMARY KEY(employee_id,period)
);
-- Add only planned time on business dates without a confirmed attendance record.
CREATE OR REPLACE FUNCTION staff_planned_extra(emp uuid,m date) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT coalesce(round(sum(CASE d.mode WHEN 'hour' THEN d.rate*p.minutes/60 WHEN 'day' THEN d.rate ELSE 0 END),2),0)
 FROM staff_daily(emp,m) d JOIN (
 SELECT staff_day(starts) AS work_day,sum(extract(epoch FROM ends-starts)/60-pause) minutes FROM staff_shifts
 WHERE employee_id=emp AND starts >= (m::timestamp AT TIME ZONE 'Europe/Sofia') AND starts < ((m+interval '1 month') AT TIME ZONE 'Europe/Sofia')
 GROUP BY 1) p ON p.work_day=d.d WHERE d.minutes IS NULL AND NOT EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=emp AND period=m)
$$;
COMMIT;
