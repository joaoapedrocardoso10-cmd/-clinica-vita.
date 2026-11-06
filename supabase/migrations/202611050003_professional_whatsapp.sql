alter table public.professionals
  add column if not exists whatsapp_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professionals_whatsapp_phone_check'
      and conrelid = 'public.professionals'::regclass
  ) then
    alter table public.professionals
      add constraint professionals_whatsapp_phone_check
      check (
        whatsapp_phone is null
        or length(regexp_replace(whatsapp_phone, '[^0-9]', '', 'g')) between 10 and 15
      );
  end if;
end
$$;

comment on column public.professionals.whatsapp_phone is
  'Public business contact for direct WhatsApp conversation; store digits with country code when available.';
