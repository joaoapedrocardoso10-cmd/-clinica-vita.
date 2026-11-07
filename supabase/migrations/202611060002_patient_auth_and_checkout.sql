-- Patient social sign-in support and optional Mercado Pago Checkout Pro.
-- Additive migration: existing appointments remain intact.
alter table public.appointments
  add column if not exists payment_method text not null default 'whatsapp',
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_amount_cents integer,
  add column if not exists payment_provider_preference_id text,
  add column if not exists payment_provider_payment_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='appointments_payment_method_check') then
    alter table public.appointments add constraint appointments_payment_method_check check (payment_method in ('whatsapp','online'));
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_payment_status_check') then
    alter table public.appointments add constraint appointments_payment_status_check check (payment_status in ('not_required','pending','approved','rejected','cancelled','refunded','expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_payment_amount_check') then
    alter table public.appointments add constraint appointments_payment_amount_check check (payment_amount_cents is null or payment_amount_cents >= 0);
  end if;
end $$;
create index if not exists appointments_pending_checkout_idx
  on public.appointments(payment_expires_at) where payment_method='online' and status='pending';

-- A confirmed email can only be connected to its own account, never to someone else's.
create or replace function public.link_patient_auth_account()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_phone text;
begin
  if new.raw_user_meta_data->>'account_type' is distinct from 'patient' or new.email is null or new.email_confirmed_at is null then return new; end if;
  v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1));
  v_phone:=coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''),'');
  insert into public.patients(auth_user_id,full_name,email,phone)
  values(new.id,v_name,lower(new.email),v_phone)
  on conflict ((lower(email))) do update set
    auth_user_id=excluded.auth_user_id,
    full_name=case when public.patients.full_name='' then excluded.full_name else public.patients.full_name end,
    phone=case when public.patients.phone='' then excluded.phone else public.patients.phone end,
    updated_at=now()
  where public.patients.auth_user_id is null or public.patients.auth_user_id=excluded.auth_user_id;
  return new;
end;
$$;
drop trigger if exists on_auth_patient_created on auth.users;
create trigger on_auth_patient_created after insert on auth.users
for each row execute function public.link_patient_auth_account();

create or replace function public.ensure_my_patient_profile()
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_user auth.users%rowtype;
  v_patient public.patients%rowtype;
  v_name text;
  v_phone text;
begin
  if (select auth.uid()) is null then return false; end if;
  select * into v_user from auth.users where id=(select auth.uid());
  if not found or v_user.email is null or v_user.email_confirmed_at is null then return false; end if;
  v_name:=coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'),''),nullif(trim(v_user.raw_user_meta_data->>'name'),''),split_part(v_user.email,'@',1));
  v_phone:=coalesce(nullif(trim(v_user.raw_user_meta_data->>'phone'),''),'');
  select * into v_patient from public.patients where lower(email)=lower(v_user.email) for update;
  if found then
    if v_patient.auth_user_id is not null and v_patient.auth_user_id<>(select auth.uid()) then return false; end if;
    update public.patients set auth_user_id=(select auth.uid()),
      full_name=case when full_name='' then v_name else full_name end,
      phone=case when phone='' then v_phone else phone end,
      updated_at=now()
    where id=v_patient.id;
    return true;
  end if;
  insert into public.patients(auth_user_id,full_name,email,phone)
  values((select auth.uid()),v_name,lower(v_user.email),v_phone);
  return true;
exception when unique_violation then
  select * into v_patient from public.patients where lower(email)=lower(v_user.email);
  return found and v_patient.auth_user_id=(select auth.uid());
end;
$$;
revoke all on function public.ensure_my_patient_profile() from public;
grant execute on function public.ensure_my_patient_profile() to authenticated;

create or replace function public.release_expired_online_holds()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  update public.appointments set status='cancelled',payment_status='expired',updated_at=now()
  where payment_method='online' and payment_status in ('pending','rejected')
    and status='pending' and payment_expires_at is not null and payment_expires_at<=now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.release_expired_online_holds() from public;
grant execute on function public.release_expired_online_holds() to anon,authenticated;

create or replace function public.book_appointment_with_payment(
  p_service_id uuid,p_professional_id uuid,p_starts_at timestamptz,
  p_patient_name text,p_patient_email text,p_patient_phone text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_appointment_id uuid; v_price integer;
begin
  perform public.release_expired_online_holds();
  select price_cents into v_price from public.services where id=p_service_id and active=true;
  if v_price is null or v_price<=0 then raise exception 'online_price_required'; end if;
  v_appointment_id:=public.book_appointment(
    p_service_id,p_professional_id,p_starts_at,p_patient_name,p_patient_email,p_patient_phone
  );
  update public.appointments set payment_method='online',payment_status='pending',
    payment_expires_at=now()+interval '20 minutes',payment_amount_cents=v_price,updated_at=now()
  where id=v_appointment_id;
  return v_appointment_id;
end;
$$;
revoke all on function public.book_appointment_with_payment(uuid,uuid,timestamptz,text,text,text) from public;
grant execute on function public.book_appointment_with_payment(uuid,uuid,timestamptz,text,text,text) to anon,authenticated;

create or replace function public.checkout_public_status(p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform public.release_expired_online_holds();
  select jsonb_build_object(
    'status',a.status,
    'payment_status',a.payment_status,
    'starts_at',a.starts_at,
    'payment_expires_at',a.payment_expires_at
  ) into v_result
  from public.appointments a where a.id=p_appointment_id and a.payment_method='online';
  return v_result;
end;
$$;
revoke all on function public.checkout_public_status(uuid) from public;
grant execute on function public.checkout_public_status(uuid) to anon,authenticated;
