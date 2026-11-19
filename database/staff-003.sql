BEGIN;
CREATE OR REPLACE FUNCTION staff_record(emp uuid, request_key uuid, op text, data jsonb, actor_name text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 old_request staff_audit_log; employee staff_employees; rec_id uuid:=coalesce((data->>'id')::uuid,request_key);
 first_ts timestamptz; last_ts timestamptz; first_d date; last_d date; m date;
 previous_day date; step integer; repeats integer:=coalesce((data->>'repeat')::int,1);
 pause_minutes integer:=coalesce((data->>'pause')::int,0); slip jsonb; advance_total numeric; previous jsonb;
BEGIN
 SELECT * INTO STRICT employee FROM staff_employees WHERE id=emp FOR UPDATE;
 SELECT * INTO old_request FROM staff_audit_log WHERE request_id=request_key;
 IF FOUND THEN
   IF old_request.employee_id=emp AND old_request.action=op AND old_request.actor=actor_name AND old_request.payload-'before'=data THEN RETURN; END IF;
   RAISE EXCEPTION 'Идентификаторът вече е използван.';
 END IF;
 IF NOT employee.active AND op IN ('shift','start','leave') THEN RAISE EXCEPTION 'Служителят е архивиран.'; END IF;
 first_ts:=(data->>'start')::timestamp AT TIME ZONE 'Europe/Sofia';
 last_ts:=(data->>'end')::timestamp AT TIME ZONE 'Europe/Sofia';
 first_d:=coalesce(staff_day(first_ts),(data->>'date')::date,(data->>'period')::date);
 last_d:=coalesce((data->>'until')::date,first_d);
 IF op='start' THEN first_ts:=now(); first_d:=staff_day(first_ts); END IF;
 IF op IN ('finish','time') AND data ? 'id' THEN
   SELECT staff_day(starts),to_jsonb(t) INTO STRICT previous_day,previous FROM staff_time_entries t
   WHERE id=rec_id AND employee_id=emp AND version=(data->>'version')::int;
   IF op='finish' THEN
     IF previous->>'ends' IS NOT NULL THEN RAISE EXCEPTION 'Смяната вече е приключена.'; END IF;
     first_ts:=(previous->>'starts')::timestamptz; last_ts:=now(); first_d:=previous_day;
   END IF;
 END IF;
 IF op='decision' THEN SELECT first_day,last_day INTO STRICT first_d,last_d FROM staff_leave_requests WHERE id=rec_id AND employee_id=emp AND status='pending'; END IF;
 IF op='bonusDecision' THEN SELECT period INTO STRICT first_d FROM staff_bonus_requests WHERE id=rec_id AND employee_id=emp AND status='pending'; END IF;
 IF op IN ('money','bonusRequest') THEN first_d:=(data->>'period')::date; END IF;
 IF op<>'money' OR data->>'kind' NOT IN ('advance','payment') THEN
   IF EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=emp AND
     (period=date_trunc('month',first_d)::date OR period=date_trunc('month',previous_day)::date OR
     (op='contract' AND period+interval '1 month'>first_d) OR
     (op IN ('decision','leave') AND period<=last_d AND period+interval '1 month'>first_d)))
   THEN RAISE EXCEPTION 'Периодът е заключен.'; END IF;
 END IF;
 IF op IN ('shift','time','start','contract','leave') AND first_d<employee.hired_on THEN RAISE EXCEPTION 'Датата предхожда назначаването.'; END IF;
 CASE op
 WHEN 'contract' THEN
   INSERT INTO staff_contracts VALUES(request_key,emp,first_d,data->>'mode',(data->>'rate')::numeric,
    (data->>'hours')::numeric,data->>'employment',(data->>'rest')::numeric,(data->>'weeklyRest')::numeric)
   ON CONFLICT(employee_id,effective) DO UPDATE SET mode=excluded.mode,rate=excluded.rate,hours=excluded.hours,
    employment=excluded.employment,rest_hours=excluded.rest_hours,weekly_rest=excluded.weekly_rest;
 WHEN 'cancel' THEN
   SELECT to_jsonb(s) INTO STRICT previous FROM staff_shifts s WHERE employee_id=emp AND id=rec_id AND version=(data->>'version')::int;
   IF EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=emp AND period=date_trunc('month',staff_day((previous->>'starts')::timestamptz))::date) THEN RAISE EXCEPTION 'Периодът е заключен.'; END IF;
   DELETE FROM staff_shifts WHERE id=rec_id AND employee_id=emp;
 WHEN 'shift' THEN
   IF data ? 'id' THEN
     SELECT to_jsonb(s) INTO STRICT previous FROM staff_shifts s WHERE employee_id=emp AND id=rec_id AND version=(data->>'version')::int;
     IF EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=emp AND period=date_trunc('month',staff_day((previous->>'starts')::timestamptz))::date) THEN RAISE EXCEPTION 'Периодът е заключен.'; END IF;
   END IF;
   FOR step IN 1..repeats LOOP
     IF EXISTS(SELECT 1 FROM staff_payroll_entries WHERE employee_id=emp AND period=date_trunc('month',staff_day(first_ts))::date) THEN RAISE EXCEPTION 'Периодът е заключен.'; END IF;
     IF EXISTS(SELECT 1 FROM staff_shifts WHERE employee_id=emp AND id<>rec_id AND starts<last_ts AND ends>first_ts)
       OR EXISTS(SELECT 1 FROM staff_leave_requests WHERE employee_id=emp AND status='approved' AND first_day<=staff_day(last_ts-interval '1 microsecond') AND last_day>=staff_day(first_ts))
       THEN RAISE EXCEPTION 'Има застъпване със смяна или одобрено отсъствие.'; END IF;
     IF step=1 AND data ? 'id' THEN UPDATE staff_shifts SET starts=first_ts,ends=last_ts,pause=pause_minutes,version=version+1 WHERE id=rec_id;
     ELSE INSERT INTO staff_shifts(id,employee_id,starts,ends,pause) VALUES(CASE WHEN step=1 THEN rec_id ELSE gen_random_uuid() END,emp,first_ts,last_ts,pause_minutes); END IF;
     first_ts:=((first_ts AT TIME ZONE 'Europe/Sofia')+interval '7 days') AT TIME ZONE 'Europe/Sofia';
     last_ts:=((last_ts AT TIME ZONE 'Europe/Sofia')+interval '7 days') AT TIME ZONE 'Europe/Sofia';
   END LOOP;
 WHEN 'time','start','finish' THEN
   IF EXISTS(SELECT 1 FROM staff_time_entries WHERE employee_id=emp AND id<>rec_id
     AND starts<coalesce(last_ts,'infinity') AND coalesce(ends,'infinity')>first_ts) THEN RAISE EXCEPTION 'Времето се застъпва с друг отчет.'; END IF;
   IF data ? 'id' THEN UPDATE staff_time_entries SET starts=first_ts,ends=last_ts,pause=pause_minutes,confirmed=coalesce((data->>'confirmed')::boolean,false),version=version+1 WHERE id=rec_id;
   ELSE INSERT INTO staff_time_entries(id,employee_id,starts,ends,pause,confirmed) VALUES(rec_id,emp,first_ts,last_ts,pause_minutes,coalesce((data->>'confirmed')::boolean,false)); END IF;
 WHEN 'leave','decision' THEN
   IF op='decision' AND data->>'status'='approved' THEN
     IF EXISTS(SELECT 1 FROM staff_shifts WHERE employee_id=emp AND staff_day(starts)<=last_d AND staff_day(ends-interval '1 microsecond')>=first_d)
       OR EXISTS(SELECT 1 FROM staff_leave_requests WHERE employee_id=emp AND status='approved' AND first_day<=last_d AND last_day>=first_d)
       THEN RAISE EXCEPTION 'Периодът се застъпва със смяна или отсъствие.'; END IF;
   END IF;
   IF op='decision' THEN UPDATE staff_leave_requests SET status=data->>'status' WHERE id=rec_id;
   ELSE INSERT INTO staff_leave_requests VALUES(rec_id,emp,first_d,last_d,data->>'kind','pending'); END IF;
 WHEN 'bonusRequest' THEN
   INSERT INTO staff_bonus_requests(id,employee_id,period,booked,amount,reason,actor)
   VALUES(rec_id,emp,first_d,(data->>'date')::date,(data->>'amount')::numeric,data->>'reason',actor_name);
 WHEN 'bonusDecision' THEN
   UPDATE staff_bonus_requests SET status=data->>'status',decided_by=actor_name,decided_at=now() WHERE id=rec_id;
   IF data->>'status'='approved' THEN
     INSERT INTO staff_amounts SELECT id,employee_id,period,booked,'bonus',amount,reason,NULL,actor_name FROM staff_bonus_requests WHERE id=rec_id;
   END IF;
 WHEN 'money' THEN
   m:=(data->>'period')::date;
   IF data->>'kind' IN ('advance','payment') THEN
     slip:=staff_statement(emp,m);
     IF (slip->>'closed')::boolean AND (data->>'amount')::numeric>(slip->>'remaining')::numeric THEN RAISE EXCEPTION 'Сумата надхвърля неплатения остатък.'; END IF;
   END IF;
   INSERT INTO staff_amounts VALUES(rec_id,emp,m,(data->>'date')::date,data->>'kind',(data->>'amount')::numeric,data->>'reason',data->>'method',actor_name);
 WHEN 'close' THEN
   m:=(data->>'period')::date;
   IF m+interval '1 month'>staff_day(now()) THEN RAISE EXCEPTION 'Месецът още не е приключил.'; END IF;
   IF EXISTS(SELECT 1 FROM staff_time_entries WHERE employee_id=emp AND staff_day(starts)>=m AND staff_day(starts)<m+interval '1 month' AND NOT confirmed) THEN RAISE EXCEPTION 'Има непотвърдени часове.'; END IF;
   IF EXISTS(SELECT 1 FROM staff_bonus_requests WHERE employee_id=emp AND period=m AND status='pending') THEN RAISE EXCEPTION 'Има бонус за одобрение.'; END IF;
   slip:=staff_statement(emp,m);
   IF (slip->>'missing')::int>0 OR NOT EXISTS(SELECT 1 FROM staff_contracts WHERE employee_id=emp AND effective<m+interval '1 month') THEN RAISE EXCEPTION 'Липсва договорена ставка.'; END IF;
   advance_total:=(slip->>'advances')::numeric+(slip->>'payments')::numeric;
   IF (data->>'net')::numeric<advance_total THEN RAISE EXCEPTION 'Нетната сума е под изплатеното.'; END IF;
   INSERT INTO staff_payroll_entries(employee_id,period,snapshot,net,closed_by) VALUES(emp,m,slip-'remaining'-'net'-'advances'-'payments'-'closed',(data->>'net')::numeric,actor_name);
 ELSE RAISE EXCEPTION 'Непозната операция.';
 END CASE;
 INSERT INTO staff_audit_log VALUES(request_key,emp,op,actor_name,CASE WHEN previous IS NULL THEN data ELSE data||jsonb_build_object('before',previous) END,now());
END $$;
COMMIT;
