BEGIN;
CREATE OR REPLACE FUNCTION staff_weekly_costs(m date)
RETURNS TABLE(week date, base numeric, supplements numeric, paid numeric) LANGUAGE sql STABLE AS $$
 WITH daily AS (
  SELECT d.d,CASE d.mode WHEN 'month' THEN d.rate/((m+interval '1 month')::date-m)
   WHEN 'day' THEN CASE WHEN d.minutes>0 THEN d.rate ELSE 0 END
   WHEN 'hour' THEN d.rate*d.minutes/60 ELSE 0 END AS cost
  FROM staff_employees e CROSS JOIN LATERAL staff_daily(e.id,m) d
 ), events AS (
 SELECT d,coalesce(cost,0) basis,0 extra,0 payout FROM daily
 UNION ALL SELECT booked,0, CASE WHEN kind IN ('bonus','overtime','holiday','night') THEN amount ELSE 0 END,
 CASE WHEN kind IN ('payment','advance') THEN amount ELSE 0 END FROM staff_amounts WHERE period=m
 )
 SELECT date_trunc('week',d)::date,round(sum(basis),2),sum(extra),sum(payout) FROM events GROUP BY 1 ORDER BY 1
$$;
-- Per-contract scheduling recommendations. A week with no shift has a full week of rest.
CREATE OR REPLACE FUNCTION staff_rest_warnings(m date)
RETURNS TABLE(employee_id uuid,work_day date,kind text,hours numeric,minimum numeric) LANGUAGE sql STABLE AS $$
 WITH scheduled AS (
 SELECT s.*,lag(ends) OVER(PARTITION BY s.employee_id ORDER BY starts) prev_end
 FROM staff_shifts s WHERE starts>=((m-14)::timestamp AT TIME ZONE 'Europe/Sofia')
 AND starts<((m+interval '1 month 7 days') AT TIME ZONE 'Europe/Sofia')
 ), weekly AS (
 SELECT DISTINCT s.employee_id,date_trunc('week',staff_day(s.starts))::date AS monday FROM scheduled s
 ), gaps AS (
 SELECT w.employee_id,w.monday,g.gap FROM weekly w CROSS JOIN LATERAL (
 SELECT max(extract(epoch FROM free_until-free_from)/3600) gap FROM (
 SELECT greatest(coalesce(lag(ends) OVER(ORDER BY starts),w.monday::timestamp AT TIME ZONE 'Europe/Sofia'),w.monday::timestamp AT TIME ZONE 'Europe/Sofia') free_from,
 least(starts,(w.monday+7)::timestamp AT TIME ZONE 'Europe/Sofia') free_until
 FROM (SELECT starts,ends FROM scheduled s WHERE s.employee_id=w.employee_id AND ends>w.monday::timestamp AT TIME ZONE 'Europe/Sofia'
 AND starts<(w.monday+7)::timestamp AT TIME ZONE 'Europe/Sofia'
 UNION ALL SELECT (w.monday+7)::timestamp AT TIME ZONE 'Europe/Sofia',(w.monday+7)::timestamp AT TIME ZONE 'Europe/Sofia') slots) intervals) g
 )
 SELECT s.employee_id,staff_day(s.starts),'daily',round(extract(epoch FROM s.starts-s.prev_end)/3600,2),c.rest_hours FROM scheduled s
 JOIN LATERAL(SELECT rest_hours FROM staff_contracts WHERE employee_id=s.employee_id AND effective<=staff_day(s.starts) ORDER BY effective DESC LIMIT 1)c ON true
 WHERE s.starts-s.prev_end<c.rest_hours*interval '1 hour' AND staff_day(s.starts)>=m AND staff_day(s.starts)<m+interval '1 month'
 UNION ALL SELECT g.employee_id,g.monday,'weekly',round(g.gap,2),c.weekly_rest FROM gaps g
 JOIN LATERAL(SELECT weekly_rest FROM staff_contracts WHERE employee_id=g.employee_id AND effective<=g.monday+6 ORDER BY effective DESC LIMIT 1)c ON true
 WHERE g.gap<c.weekly_rest AND g.monday+6>=m AND g.monday<m+interval '1 month'
$$;
COMMIT;
