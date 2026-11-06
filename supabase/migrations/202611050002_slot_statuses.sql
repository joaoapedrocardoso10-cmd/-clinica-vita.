-- Safe additive migration: exposes only free/busy state for public booking slots.
-- Patient names, contact details, appointment IDs, and exact booking records are never returned.
create or replace function public.slot_options(
  p_service_id uuid,
  p_professional_id uuid,
  p_date date
) returns table(starts_at timestamptz, ends_at timestamptz, status text)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_duration integer;
  v_weekday integer;
  v_now timestamptz := now();
begin
  select s.duration_minutes into v_duration
  from public.services s
  join public.service_professionals sp on sp.service_id=s.id and sp.professional_id=p_professional_id
  join public.professionals pr on pr.id=sp.professional_id and pr.active=true
  where s.id=p_service_id and s.active=true;

  if v_duration is null then return; end if;
  v_weekday := extract(dow from p_date)::integer;

  return query
  with windows as (
    select (p_date+a.starts_at) at time zone 'America/Sao_Paulo' as window_start,
           (p_date+a.ends_at) at time zone 'America/Sao_Paulo' as window_end
    from public.professional_availability a
    where a.professional_id=p_professional_id and a.weekday=v_weekday and a.active=true
  ), generated as (
    select gs as slot_start, gs+make_interval(mins=>v_duration) as slot_end
    from windows w
    cross join lateral generate_series(
      w.window_start,
      w.window_end-make_interval(mins=>v_duration),
      make_interval(mins=>v_duration)
    ) gs
  )
  select g.slot_start, g.slot_end,
    case
      when exists (
        select 1 from public.appointments a
        where a.professional_id=p_professional_id
          and a.status in ('pending','confirmed')
          and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(g.slot_start,g.slot_end,'[)')
      ) then 'booked'
      when exists (
        select 1 from public.availability_exceptions e
        where e.professional_id=p_professional_id
          and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(g.slot_start,g.slot_end,'[)')
      ) then 'blocked'
      else 'available'
    end::text
  from generated g
  where g.slot_start>v_now
  order by g.slot_start;
end;
$$;

revoke all on function public.slot_options(uuid,uuid,date) from public;
grant execute on function public.slot_options(uuid,uuid,date) to anon,authenticated;

-- Atomically creates a same-weekday, same-time series for the selected dates.
-- Every occurrence is validated before any appointment is inserted.
create or replace function public.book_recurring_appointments(
  p_service_id uuid,
  p_professional_id uuid,
  p_dates date[],
  p_time time,
  p_patient_name text,
  p_patient_email text,
  p_patient_phone text
) returns uuid[]
language plpgsql
security definer
set search_path=''
as $$
declare
  v_duration integer;
  v_patient_id uuid;
  v_date date;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_appointment_ids uuid[] := array[]::uuid[];
begin
  if coalesce(cardinality(p_dates),0) < 2 or cardinality(p_dates) > 6
    or p_dates is null
    or length(trim(p_patient_name)) < 2 or length(trim(p_patient_name)) > 120
    or length(trim(p_patient_phone)) < 8 or length(trim(p_patient_email)) > 254 then
    raise exception 'invalid_recurring_request';
  end if;

  if (select count(distinct d) from unnest(p_dates) as dates(d)) <> cardinality(p_dates)
    or (select count(distinct extract(dow from d)) from unnest(p_dates) as dates(d)) <> 1
    or (select count(distinct to_char(d,'YYYY-MM')) from unnest(p_dates) as dates(d)) <> 1
    or (select min(d) from unnest(p_dates) as dates(d)) < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'invalid_recurring_dates';
  end if;

  select s.duration_minutes into v_duration
  from public.services s
  join public.service_professionals sp on sp.service_id=s.id and sp.professional_id=p_professional_id
  join public.professionals pr on pr.id=sp.professional_id and pr.active=true
  where s.id=p_service_id and s.active=true;
  if v_duration is null then raise exception 'slot_unavailable'; end if;

  -- Validate the complete series before writing anything; one conflict rejects the whole series.
  for v_date in select d from unnest(p_dates) as dates(d) order by d loop
    v_starts_at := (v_date+p_time) at time zone 'America/Sao_Paulo';
    if not exists (
      select 1 from public.available_slots(p_service_id,p_professional_id,v_date) a
      where a.starts_at=v_starts_at
    ) then
      raise exception 'slot_unavailable';
    end if;
  end loop;

  insert into public.patients(full_name,email,phone)
  values(trim(p_patient_name),lower(trim(p_patient_email)),trim(p_patient_phone))
  on conflict do nothing returning id into v_patient_id;
  if v_patient_id is null then
    select id into v_patient_id from public.patients where lower(email)=lower(trim(p_patient_email));
  end if;

  for v_date in select d from unnest(p_dates) as dates(d) order by d loop
    v_starts_at := (v_date+p_time) at time zone 'America/Sao_Paulo';
    v_ends_at := v_starts_at+make_interval(mins=>v_duration);
    insert into public.appointments(patient_id,professional_id,service_id,starts_at,ends_at,status)
    values(v_patient_id,p_professional_id,p_service_id,v_starts_at,v_ends_at,'pending')
    returning id into v_appointment_id;
    v_appointment_ids := array_append(v_appointment_ids,v_appointment_id);
  end loop;

  return v_appointment_ids;
end;
$$;

revoke all on function public.book_recurring_appointments(uuid,uuid,date[],time,text,text,text) from public;
grant execute on function public.book_recurring_appointments(uuid,uuid,date[],time,text,text,text) to anon,authenticated;
