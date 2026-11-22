BEGIN;
CREATE OR REPLACE FUNCTION staff_copy_week(target date, key uuid, actor text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s staff_shifts; n integer:=0;
BEGIN
 IF extract(isodow from target)<>1 THEN RAISE EXCEPTION 'Избери понеделник.'; END IF;
 FOR s IN SELECT * FROM staff_shifts WHERE staff_day(starts)>=target-7 AND staff_day(starts)<target ORDER BY employee_id,id LOOP
  n:=n+1;
  PERFORM staff_record(s.employee_id,md5(key::text||s.id::text)::uuid,'shift',
   jsonb_build_object('start',to_char((s.starts AT TIME ZONE 'Europe/Sofia')+interval '7 days','YYYY-MM-DD"T"HH24:MI'),
   'end',to_char((s.ends AT TIME ZONE 'Europe/Sofia')+interval '7 days','YYYY-MM-DD"T"HH24:MI'),'pause',s.pause,'repeat',1),actor);
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION 'Предходната седмица няма смени.'; END IF;
END $$;
-- Protect payroll history when editing the base register.
CREATE OR REPLACE FUNCTION staff_guard_employee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.hired_on<>NEW.hired_on AND (EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=OLD.id)
 OR EXISTS(SELECT 1 FROM staff_time_entries WHERE employee_id=OLD.id AND staff_day(starts)<NEW.hired_on)
 OR EXISTS(SELECT 1 FROM staff_contracts WHERE employee_id=OLD.id AND effective<NEW.hired_on)) THEN
 RAISE EXCEPTION 'Датата противоречи на съществуващ договор, отчет или приключен период.'; END IF;
 IF OLD.active AND NOT NEW.active AND EXISTS(SELECT 1 FROM staff_time_entries WHERE employee_id=OLD.id AND ends IS NULL)
 THEN RAISE EXCEPTION 'Първо приключи отворената смяна.'; END IF;
 IF OLD.active AND NOT NEW.active THEN
  INSERT INTO staff_inactive_periods(employee_id,since) VALUES(OLD.id,staff_day(now())+1)
  ON CONFLICT(employee_id,since) DO UPDATE SET until_day=NULL;
 ELSIF NEW.active AND NOT OLD.active THEN
  UPDATE staff_inactive_periods SET until_day=greatest(since,staff_day(now())) WHERE employee_id=OLD.id AND until_day IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER staff_guard_employee BEFORE UPDATE ON staff_employees FOR EACH ROW EXECUTE FUNCTION staff_guard_employee();
COMMIT;
