-- Premium patient portal and appointment change requests.
alter table public.patients add column if not exists updated_at timestamptz not null default now();

create table if not exists public.patient_appointment_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  request_type text not null check (request_type in ('cancel','reschedule')),
  requested_starts_at timestamptz,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((request_type='reschedule' and requested_starts_at is not null) or (request_type='cancel' and requested_starts_at is null))
);
create index if not exists patient_requests_created_idx on public.patient_appointment_requests(created_at desc);
create index if not exists patient_requests_appointment_idx on public.patient_appointment_requests(appointment_id,status);
create unique index if not exists patient_requests_one_pending_idx
  on public.patient_appointment_requests(appointment_id) where status='pending';

alter table public.patient_appointment_requests enable row level security;
drop policy if exists "patients read own change requests" on public.patient_appointment_requests;
create policy "patients read own change requests" on public.patient_appointment_requests
  for select to authenticated using (exists (
    select 1 from public.patients p where p.id=patient_id and p.auth_user_id=(select auth.uid())
  ));
drop policy if exists "patients create own change requests" on public.patient_appointment_requests;
create policy "patients create own change requests" on public.patient_appointment_requests
  for insert to authenticated with check (exists (
    select 1 from public.patients p where p.id=patient_id and p.auth_user_id=(select auth.uid())
  ) and exists (
    select 1 from public.appointments a where a.id=patient_appointment_requests.appointment_id and a.patient_id=patient_appointment_requests.patient_id
      and a.status in ('pending','confirmed') and a.starts_at>now()
  ));
drop policy if exists "staff manages patient change requests" on public.patient_appointment_requests;
drop policy if exists "staff reads patient change requests" on public.patient_appointment_requests;
create policy "staff reads patient change requests" on public.patient_appointment_requests
  for select to authenticated using (public.current_staff_role() in ('admin','receptionist'));
revoke update,delete on public.patient_appointment_requests from authenticated;
grant select,insert on public.patient_appointment_requests to authenticated;

-- A patient account is linked to an existing booking by verified email or created from signup metadata.
create or replace function public.link_patient_auth_account()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_phone text;
begin
  if new.raw_user_meta_data->>'account_type' is distinct from 'patient' then return new; end if;
  v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1));
  v_phone:=coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''),'');
  insert into public.patients(auth_user_id,full_name,email,phone)
  values(new.id,v_name,lower(new.email),v_phone)
  on conflict ((lower(email))) do update set
    auth_user_id=excluded.auth_user_id,
    full_name=case when public.patients.full_name='' then excluded.full_name else public.patients.full_name end,
    phone=case when public.patients.phone='' then excluded.phone else public.patients.phone end,
    updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_patient_created on auth.users;
create trigger on_auth_patient_created after insert on auth.users
for each row execute function public.link_patient_auth_account();

-- Narrow profile updates are exposed through a security-definer RPC, not unrestricted row writes.
create or replace function public.update_my_patient_profile(p_full_name text,p_phone text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or length(trim(p_full_name))<2 or length(trim(p_full_name))>120
    or length(trim(p_phone))<8 or length(trim(p_phone))>30 then return false; end if;
  update public.patients set full_name=trim(p_full_name),phone=trim(p_phone),updated_at=now()
  where auth_user_id=(select auth.uid());
  return found;
end;
$$;
revoke all on function public.update_my_patient_profile(text,text) from public;
grant execute on function public.update_my_patient_profile(text,text) to authenticated;

drop policy if exists "patients read own profile" on public.patients;
create policy "patients read own profile" on public.patients for select to authenticated
  using (auth_user_id=(select auth.uid()));
drop policy if exists "patients read own appointments" on public.appointments;
create policy "patients read own appointments" on public.appointments for select to authenticated
  using (exists(select 1 from public.patients p where p.id=patient_id and p.auth_user_id=(select auth.uid())));
revoke update on public.patients from authenticated;
grant update(full_name,phone,updated_at) on public.patients to authenticated;

-- Only administrators can change clinic-wide schedules and exception windows.
drop policy if exists "staff manages availability" on public.professional_availability;
drop policy if exists "admin manages availability" on public.professional_availability;
create policy "admin manages availability" on public.professional_availability for all to authenticated
  using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "staff manages exceptions" on public.availability_exceptions;
drop policy if exists "admin manages exceptions" on public.availability_exceptions;
create policy "admin manages exceptions" on public.availability_exceptions for all to authenticated
  using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');

-- Admin/reception can review requests; the action is revalidated and applied atomically.
create or replace function public.review_patient_appointment_request(p_request_id uuid,p_decision text,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_request public.patient_appointment_requests%rowtype; v_appt public.appointments%rowtype;
begin
  if public.current_staff_role() not in ('admin','receptionist') or p_actor is distinct from (select auth.uid()) or p_decision not in ('approved','declined') then return false; end if;
  select * into v_request from public.patient_appointment_requests where id=p_request_id and status='pending' for update;
  if not found then return false; end if;
  select * into v_appt from public.appointments where id=v_request.appointment_id for update;
  if not found or v_appt.status not in ('pending','confirmed') then return false; end if;
  if p_decision='approved' and v_request.request_type='cancel' then
    update public.appointments set status='cancelled',updated_at=now() where id=v_appt.id;
  elsif p_decision='approved' and v_request.request_type='reschedule' then
    if v_request.requested_starts_at<=now() then return false; end if;
    update public.appointments set status='cancelled',updated_at=now() where id=v_appt.id;
    if not exists (
      select 1 from public.available_slots(v_appt.service_id,v_appt.professional_id,(v_request.requested_starts_at at time zone 'America/Sao_Paulo')::date) s
      where s.starts_at=v_request.requested_starts_at
    ) then raise exception 'requested_slot_unavailable'; end if;
    if exists(
      select 1 from public.appointments a where a.professional_id=v_appt.professional_id
      and a.id<>v_appt.id and a.status in ('pending','confirmed')
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_request.requested_starts_at,v_request.requested_starts_at+(v_appt.ends_at-v_appt.starts_at),'[)')
    ) then raise exception 'requested_slot_unavailable'; end if;
    update public.appointments set status=v_appt.status,starts_at=v_request.requested_starts_at,
      ends_at=v_request.requested_starts_at+(v_appt.ends_at-v_appt.starts_at),updated_at=now() where id=v_appt.id;
  end if;
  update public.patient_appointment_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now() where id=v_request.id;
  insert into public.admin_audit_log(actor_id,action,entity_type,entity_id)
  values(p_actor,'patient_request_'||p_decision,'patient_appointment_request',v_request.id);
  return true;
end;
$$;
revoke all on function public.review_patient_appointment_request(uuid,text,uuid) from public;
grant execute on function public.review_patient_appointment_request(uuid,text,uuid) to authenticated;

-- Keep the legacy availability fallback in sync when a professional is deactivated.
create or replace function public.available_slots(p_service_id uuid,p_professional_id uuid,p_date date)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_duration integer; v_weekday integer; v_now timestamptz:=now();
begin
  select s.duration_minutes into v_duration
  from public.services s
  join public.service_professionals sp on sp.service_id=s.id and sp.professional_id=p_professional_id
  join public.professionals pr on pr.id=sp.professional_id and pr.active=true
  where s.id=p_service_id and s.active=true;
  if v_duration is null then return; end if;
  v_weekday:=extract(dow from p_date)::integer;
  return query with windows as (
    select (p_date+a.starts_at) at time zone 'America/Sao_Paulo' ws,
      (p_date+a.ends_at) at time zone 'America/Sao_Paulo' we
    from public.professional_availability a
    where a.professional_id=p_professional_id and a.weekday=v_weekday and a.active=true
  ), generated as (
    select gs ss,gs+make_interval(mins=>v_duration) ee
    from windows w cross join lateral generate_series(w.ws,w.we-make_interval(mins=>v_duration),make_interval(mins=>v_duration)) gs
  )
  select g.ss,g.ee from generated g
  where g.ss>v_now
    and not exists(select 1 from public.appointments a where a.professional_id=p_professional_id and a.status in ('pending','confirmed') and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(g.ss,g.ee,'[)'))
    and not exists(select 1 from public.availability_exceptions e where e.professional_id=p_professional_id and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(g.ss,g.ee,'[)'))
  order by g.ss;
end;
$$;

-- Aggregate-only report endpoint: no patient contact or clinical data is returned.
create or replace function public.clinic_premium_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_report jsonb;
begin
  if public.current_staff_role() is distinct from 'admin'
    or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'not_allowed_or_invalid_range';
  end if;
  with scoped as (
    select a.status,a.service_id,a.professional_id,
      (a.starts_at at time zone 'America/Sao_Paulo')::date as local_day
    from public.appointments a
    where (a.starts_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
  ), timeline as (
    select d::date as day, count(s.local_day)::integer as total,
      count(*) filter (where s.status='completed')::integer as completed,
      count(*) filter (where s.status='cancelled')::integer as cancelled
    from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
    left join scoped s on s.local_day=d::date
    group by d order by d
  ), services as (
    select coalesce(s.name,'Serviço removido') as name,count(*)::integer as total
    from scoped a left join public.services s on s.id=a.service_id
    group by s.name order by count(*) desc limit 10
  ), professionals as (
    select coalesce(p.display_name,'Profissional removido') as name,count(*)::integer as total
    from scoped a left join public.professionals p on p.id=a.professional_id
    group by p.display_name order by count(*) desc limit 10
  )
  select jsonb_build_object(
    'total',(select count(*)::integer from scoped),
    'completed',(select count(*)::integer from scoped where status='completed'),
    'cancelled',(select count(*)::integer from scoped where status='cancelled'),
    'no_show',(select count(*)::integer from scoped where status='no_show'),
    'attendance_rate',case when (select count(*) from scoped where status in ('completed','no_show'))=0 then 0 else round(100.0*(select count(*) from scoped where status='completed')/(select count(*) from scoped where status in ('completed','no_show')),1) end,
    'timeline',coalesce((select jsonb_agg(jsonb_build_object('day',day,'total',total,'completed',completed,'cancelled',cancelled) order by day) from timeline),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(jsonb_build_object('name',name,'total',total) order by total desc) from services),'[]'::jsonb),
    'professionals',coalesce((select jsonb_agg(jsonb_build_object('name',name,'total',total) order by total desc) from professionals),'[]'::jsonb)
  ) into v_report;
  return v_report;
end;
$$;
revoke all on function public.clinic_premium_report(date,date) from public;
grant execute on function public.clinic_premium_report(date,date) to authenticated;
