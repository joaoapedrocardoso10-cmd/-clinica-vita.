create extension if not exists btree_gist;

create table if not exists public.specialties (id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', active boolean not null default true);
create table if not exists public.professionals (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id) on delete set null, specialty_id uuid references public.specialties(id), display_name text not null, bio text not null default '', active boolean not null default true);
create table if not exists public.staff_profiles (user_id uuid primary key references auth.users(id) on delete cascade, full_name text not null, role text not null check(role in ('admin','receptionist','professional')), professional_id uuid references public.professionals(id), active boolean not null default true);
create table if not exists public.services (id uuid primary key default gen_random_uuid(), specialty_id uuid references public.specialties(id), name text not null, description text not null default '', duration_minutes integer not null check(duration_minutes between 10 and 240), price_cents integer check(price_cents is null or price_cents >= 0), active boolean not null default true);
create table if not exists public.service_professionals (service_id uuid not null references public.services(id) on delete cascade, professional_id uuid not null references public.professionals(id) on delete cascade, primary key(service_id,professional_id));
create table if not exists public.patients (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id) on delete set null, full_name text not null, email text not null, phone text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists patients_email_lower_idx on public.patients(lower(email));
create table if not exists public.professional_availability (id uuid primary key default gen_random_uuid(), professional_id uuid not null references public.professionals(id) on delete cascade, weekday smallint not null check(weekday between 0 and 6), starts_at time not null, ends_at time not null, active boolean not null default true, check(ends_at > starts_at));
create table if not exists public.availability_exceptions (id uuid primary key default gen_random_uuid(), professional_id uuid not null references public.professionals(id) on delete cascade, starts_at timestamptz not null, ends_at timestamptz not null, reason text not null default '', check(ends_at > starts_at));
create table if not exists public.appointments (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), professional_id uuid not null references public.professionals(id), service_id uuid not null references public.services(id), starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'pending' check(status in ('pending','confirmed','cancelled','completed','no_show')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_at > starts_at), constraint appointments_no_overlap exclude using gist(professional_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('pending','confirmed')));
create index if not exists appointments_start_idx on public.appointments(starts_at);
create table if not exists public.admin_audit_log (id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, created_at timestamptz not null default now());

create or replace function public.current_staff_role() returns text language sql stable security definer set search_path='' as $$ select role from public.staff_profiles where user_id=(select auth.uid()) and active=true limit 1 $$;
create or replace function public.is_clinic_staff() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.staff_profiles where user_id=(select auth.uid()) and active=true) $$;
revoke all on function public.current_staff_role() from public;
revoke all on function public.is_clinic_staff() from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_clinic_staff() to authenticated;

alter table public.specialties enable row level security;
alter table public.professionals enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.services enable row level security;
alter table public.service_professionals enable row level security;
alter table public.patients enable row level security;
alter table public.professional_availability enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.appointments enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "public reads active specialties" on public.specialties;
create policy "public reads active specialties" on public.specialties for select to anon,authenticated using(active);
drop policy if exists "public reads active professionals" on public.professionals;
create policy "public reads active professionals" on public.professionals for select to anon,authenticated using(active);
drop policy if exists "public reads active services" on public.services;
create policy "public reads active services" on public.services for select to anon,authenticated using(active);
drop policy if exists "public reads service assignments" on public.service_professionals;
create policy "public reads service assignments" on public.service_professionals for select to anon,authenticated using(true);
drop policy if exists "staff manages specialties" on public.specialties;
create policy "staff manages specialties" on public.specialties for all to authenticated using(public.is_clinic_staff()) with check(public.current_staff_role()='admin');
drop policy if exists "staff manages professionals" on public.professionals;
create policy "staff manages professionals" on public.professionals for all to authenticated using(public.is_clinic_staff()) with check(public.current_staff_role()='admin');
drop policy if exists "staff reads profile" on public.staff_profiles;
create policy "staff reads profile" on public.staff_profiles for select to authenticated using(user_id=(select auth.uid()) or public.current_staff_role()='admin');
drop policy if exists "admin manages staff" on public.staff_profiles;
create policy "admin manages staff" on public.staff_profiles for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "staff manages services" on public.services;
create policy "staff manages services" on public.services for all to authenticated using(public.is_clinic_staff()) with check(public.is_clinic_staff());
drop policy if exists "admin manages service assignments" on public.service_professionals;
create policy "admin manages service assignments" on public.service_professionals for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "staff reads patients" on public.patients;
create policy "staff reads patients" on public.patients for select to authenticated using(public.is_clinic_staff());
drop policy if exists "staff creates patients" on public.patients;
create policy "staff creates patients" on public.patients for insert to authenticated with check(public.is_clinic_staff());
drop policy if exists "staff updates patients" on public.patients;
create policy "staff updates patients" on public.patients for update to authenticated using(public.is_clinic_staff()) with check(public.is_clinic_staff());
drop policy if exists "public reads weekly availability" on public.professional_availability;
create policy "public reads weekly availability" on public.professional_availability for select to anon,authenticated using(active);
drop policy if exists "staff manages availability" on public.professional_availability;
create policy "staff manages availability" on public.professional_availability for all to authenticated using(public.is_clinic_staff()) with check(public.is_clinic_staff());
drop policy if exists "staff manages exceptions" on public.availability_exceptions;
create policy "staff manages exceptions" on public.availability_exceptions for all to authenticated using(public.is_clinic_staff()) with check(public.is_clinic_staff());
drop policy if exists "staff reads appointments" on public.appointments;
create policy "staff reads appointments" on public.appointments for select to authenticated using(public.is_clinic_staff());
drop policy if exists "staff updates appointments" on public.appointments;
create policy "staff updates appointments" on public.appointments for update to authenticated using(public.is_clinic_staff()) with check(public.is_clinic_staff());
drop policy if exists "staff inserts appointments" on public.appointments;
create policy "staff inserts appointments" on public.appointments for insert to authenticated with check(public.is_clinic_staff());
drop policy if exists "admin reads audit" on public.admin_audit_log;
create policy "admin reads audit" on public.admin_audit_log for select to authenticated using(public.current_staff_role()='admin');
drop policy if exists "staff writes audit" on public.admin_audit_log;
create policy "staff writes audit" on public.admin_audit_log for insert to authenticated with check(public.is_clinic_staff() and actor_id=(select auth.uid()));
grant select on public.specialties,public.professionals,public.services,public.service_professionals,public.professional_availability to anon,authenticated;
grant select,insert,update on public.patients,public.appointments to authenticated;
grant select,insert,update,delete on public.professional_availability,public.availability_exceptions,public.services,public.professionals,public.specialties,public.service_professionals,public.staff_profiles to authenticated;
grant select,insert on public.admin_audit_log to authenticated;

create or replace function public.available_slots(p_service_id uuid,p_professional_id uuid,p_date date) returns table(starts_at timestamptz,ends_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_duration integer; v_weekday integer; v_now timestamptz:=now();
begin
  select s.duration_minutes into v_duration from public.services s join public.service_professionals sp on sp.service_id=s.id and sp.professional_id=p_professional_id where s.id=p_service_id and s.active=true;
  if v_duration is null then return; end if;
  v_weekday:=extract(dow from p_date)::integer;
  return query with windows as (select (p_date+a.starts_at) at time zone 'America/Sao_Paulo' ws,(p_date+a.ends_at) at time zone 'America/Sao_Paulo' we from public.professional_availability a where a.professional_id=p_professional_id and a.weekday=v_weekday and a.active=true), generated as (select gs ss,gs+make_interval(mins=>v_duration) ee from windows w cross join lateral generate_series(w.ws,w.we-make_interval(mins=>v_duration),make_interval(mins=>v_duration)) gs)
  select g.ss,g.ee from generated g where g.ss>v_now and not exists(select 1 from public.appointments a where a.professional_id=p_professional_id and a.status in ('pending','confirmed') and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(g.ss,g.ee,'[)')) and not exists(select 1 from public.availability_exceptions e where e.professional_id=p_professional_id and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(g.ss,g.ee,'[)')) order by g.ss;
end $$;
grant execute on function public.available_slots(uuid,uuid,date) to anon,authenticated;

create or replace function public.book_appointment(p_service_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_patient_name text,p_patient_email text,p_patient_phone text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_duration integer; v_end timestamptz; v_patient_id uuid; v_appointment_id uuid;
begin
  if length(trim(p_patient_name))<2 or length(trim(p_patient_name))>120 or length(trim(p_patient_phone))<8 or length(trim(p_patient_email))>254 then raise exception 'invalid_patient'; end if;
  select s.duration_minutes into v_duration from public.services s join public.service_professionals sp on sp.service_id=s.id and sp.professional_id=p_professional_id join public.professionals pr on pr.id=sp.professional_id and pr.active where s.id=p_service_id and s.active;
  if v_duration is null then raise exception 'slot_unavailable'; end if;
  v_end:=p_starts_at+make_interval(mins=>v_duration);
  if not exists(select 1 from public.available_slots(p_service_id,p_professional_id,(p_starts_at at time zone 'America/Sao_Paulo')::date) x where x.starts_at=p_starts_at) then raise exception 'slot_unavailable'; end if;
  insert into public.patients(full_name,email,phone) values(trim(p_patient_name),lower(trim(p_patient_email)),trim(p_patient_phone)) on conflict do nothing returning id into v_patient_id;
  if v_patient_id is null then select id into v_patient_id from public.patients where lower(email)=lower(trim(p_patient_email)); end if;
  insert into public.appointments(patient_id,professional_id,service_id,starts_at,ends_at,status) values(v_patient_id,p_professional_id,p_service_id,p_starts_at,v_end,'pending') returning id into v_appointment_id;
  return v_appointment_id;
end $$;
revoke all on function public.book_appointment(uuid,uuid,timestamptz,text,text,text) from public;
grant execute on function public.book_appointment(uuid,uuid,timestamptz,text,text,text) to anon,authenticated;

insert into public.specialties(id,name,description) values
('10000000-0000-4000-8000-000000000001','Clínica geral','Atenção integral e acompanhamento.'),('10000000-0000-4000-8000-000000000002','Cardiologia','Prevenção e saúde cardiovascular.'),('10000000-0000-4000-8000-000000000003','Dermatologia','Cuidado e saúde da pele.'),('10000000-0000-4000-8000-000000000004','Pediatria','Cuidado acolhedor para crianças.') on conflict(id) do nothing;
insert into public.professionals(id,specialty_id,display_name,bio) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Dra. Helena Martins','Clínica geral · perfil fictício.'),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Dr. Rafael Costa','Cardiologia · perfil fictício.'),('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Dra. Camila Nunes','Dermatologia · perfil fictício.') on conflict(id) do nothing;
insert into public.services(id,specialty_id,name,description,duration_minutes,price_cents) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Consulta de clínica geral','Consulta demonstrativa.',30,18000),('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Consulta cardiológica','Consulta demonstrativa.',45,26000),('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Consulta dermatológica','Consulta demonstrativa.',45,24000) on conflict(id) do nothing;
insert into public.service_professionals(service_id,professional_id) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.professional_availability(professional_id,weekday,starts_at,ends_at)
select p.id,d,'09:00','17:00' from public.professionals p cross join generate_series(1,5) d
where not exists (select 1 from public.professional_availability a where a.professional_id=p.id and a.weekday=d and a.starts_at='09:00' and a.ends_at='17:00');

-- Tighten staff row access: clinicians see only their own schedule and linked patients.
drop policy if exists "staff reads appointments by role" on public.appointments;
drop policy if exists "staff updates appointments by role" on public.appointments;
drop policy if exists "staff inserts appointments by role" on public.appointments;
drop policy if exists "staff reads linked patients" on public.patients;
drop policy if exists "staff reads appointments" on public.appointments;
drop policy if exists "staff updates appointments" on public.appointments;
drop policy if exists "staff inserts appointments" on public.appointments;
drop policy if exists "staff reads patients" on public.patients;
create policy "staff reads appointments by role" on public.appointments for select to authenticated using(
  public.current_staff_role() in ('admin','receptionist') or exists(select 1 from public.staff_profiles sp where sp.user_id=(select auth.uid()) and sp.role='professional' and sp.active=true and sp.professional_id=appointments.professional_id)
);
create policy "staff updates appointments by role" on public.appointments for update to authenticated using(
  public.current_staff_role() in ('admin','receptionist') or exists(select 1 from public.staff_profiles sp where sp.user_id=(select auth.uid()) and sp.role='professional' and sp.active=true and sp.professional_id=appointments.professional_id)
) with check(
  public.current_staff_role() in ('admin','receptionist') or exists(select 1 from public.staff_profiles sp where sp.user_id=(select auth.uid()) and sp.role='professional' and sp.active=true and sp.professional_id=appointments.professional_id)
);
create policy "staff inserts appointments by role" on public.appointments for insert to authenticated with check(
  public.current_staff_role() in ('admin','receptionist') or exists(select 1 from public.staff_profiles sp where sp.user_id=(select auth.uid()) and sp.role='professional' and sp.active=true and sp.professional_id=appointments.professional_id)
);
create policy "staff reads linked patients" on public.patients for select to authenticated using(
  public.current_staff_role() in ('admin','receptionist') or exists(select 1 from public.appointments a join public.staff_profiles sp on sp.professional_id=a.professional_id where a.patient_id=patients.id and sp.user_id=(select auth.uid()) and sp.role='professional' and sp.active=true)
);

-- Restrict configuration tables to administrators; reception cannot change clinic setup.
drop policy if exists "admin manages specialties" on public.specialties;
drop policy if exists "staff manages specialties" on public.specialties;
create policy "admin manages specialties" on public.specialties for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "admin manages professionals" on public.professionals;
drop policy if exists "staff manages professionals" on public.professionals;
create policy "admin manages professionals" on public.professionals for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "admin manages services" on public.services;
drop policy if exists "staff manages services" on public.services;
create policy "admin manages services" on public.services for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "admin manages availability" on public.professional_availability;
drop policy if exists "staff manages availability" on public.professional_availability;
create policy "admin manages availability" on public.professional_availability for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "admin manages exceptions" on public.availability_exceptions;
drop policy if exists "staff manages exceptions" on public.availability_exceptions;
create policy "admin manages exceptions" on public.availability_exceptions for all to authenticated using(public.current_staff_role()='admin') with check(public.current_staff_role()='admin');
drop policy if exists "authorized staff creates patients" on public.patients;
drop policy if exists "staff creates patients" on public.patients;
create policy "authorized staff creates patients" on public.patients for insert to authenticated with check(public.current_staff_role() in ('admin','receptionist'));
drop policy if exists "authorized staff updates patients" on public.patients;
drop policy if exists "staff updates patients" on public.patients;
create policy "authorized staff updates patients" on public.patients for update to authenticated using(public.current_staff_role() in ('admin','receptionist')) with check(public.current_staff_role() in ('admin','receptionist'));
