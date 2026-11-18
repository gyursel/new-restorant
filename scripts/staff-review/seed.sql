DO $$
DECLARE
 m date:=date_trunc('month',staff_day(now()))::date; base date:=date_trunc('week',staff_day(now()))::date;
 emp uuid; i integer; j integer; d date; t text; name_list text[]:=ARRAY['Мария Петрова','Никола Димов','Елица Иванова','Стефан Колев'];
 role_list text[]:=ARRAY['Готвач','Касиер','Управител смяна','Куриер'];
BEGIN
 IF EXISTS(SELECT 1 FROM staff_employees) THEN RETURN; END IF;
 FOR i IN 1..4 LOOP
  emp:=gen_random_uuid();
  INSERT INTO staff_employees(id,name,position,hired_on) VALUES(emp,name_list[i],role_list[i],m-60);
  PERFORM staff_record(emp,gen_random_uuid(),'contract',jsonb_build_object('date',m-60,'mode',(ARRAY['hour','day','month','hour'])[i],'rate',(ARRAY[12,82,1650,10])[i],'hours',40,'employment','Примерен договор','rest',12,'weeklyRest',48),'preview');
  FOR j IN 0..4 LOOP
   d:=base+j;
   PERFORM staff_record(emp,gen_random_uuid(),'shift',jsonb_build_object('start',d||'T09:00','end',d||'T17:30','pause',30,'repeat',1),'preview');
   d:=m+j;
   IF d<staff_day(now()) THEN
    PERFORM staff_record(emp,gen_random_uuid(),'time',jsonb_build_object('start',d||'T09:00','end',d||'T17:30','pause',30,'confirmed',true,'reason','Примерен отчет'),'preview');
   END IF;
  END LOOP;
  PERFORM staff_record(emp,gen_random_uuid(),'money',jsonb_build_object('date',m,'period',m,'kind','bonus','amount',25*i,'reason','Месечен бонус'),'preview');
  PERFORM staff_record(emp,gen_random_uuid(),'money',jsonb_build_object('date',m,'period',m,'kind','advance','amount',20*i,'method','bank','reason','Аванс за месеца'),'preview');
 END LOOP;
END $$;
