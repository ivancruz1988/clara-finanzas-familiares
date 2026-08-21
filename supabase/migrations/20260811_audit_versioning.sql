alter table public.households
  add column if not exists data_version bigint not null default 0;

alter table public.transactions
  add column if not exists idempotency_key text not null default gen_random_uuid()::text;

alter table public.payment_orders
  add column if not exists idempotency_key text not null default gen_random_uuid()::text;

create unique index if not exists transactions_household_idempotency_idx
  on public.transactions(household_id,idempotency_key);

create unique index if not exists payment_orders_household_idempotency_idx
  on public.payment_orders(household_id,idempotency_key);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  data_version bigint not null,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

drop policy if exists "members read audit events" on public.audit_events;
create policy "members read audit events" on public.audit_events
  for select using (public.is_household_member(household_id));

create or replace function public.bump_household_version(target_household uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  next_version bigint;
begin
  update public.households
  set data_version = data_version + 1
  where id = target_household
  returning data_version into next_version;
  return coalesce(next_version,0);
end;
$$;

create or replace function public.audit_financial_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_household uuid;
  target_id uuid;
  next_version bigint;
begin
  if tg_op = 'DELETE' then
    target_household := old.household_id;
    target_id := old.id;
  else
    target_household := new.household_id;
    target_id := new.id;
  end if;

  if target_household is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  next_version := public.bump_household_version(target_household);

  insert into public.audit_events(household_id,user_id,event_type,entity_type,entity_id,metadata,data_version)
  values (
    target_household,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'at', now()
    ),
    next_version
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','payment_orders','monthly_budgets'] loop
    execute format('drop trigger if exists audit_%1$s_changes on public.%1$I', t);
    execute format('create trigger audit_%1$s_changes after insert or update or delete on public.%1$I for each row execute function public.audit_financial_change()', t);
  end loop;
end $$;

create index if not exists audit_events_household_version_idx
  on public.audit_events(household_id,data_version desc);

revoke all on function public.bump_household_version(uuid) from public;
revoke all on function public.audit_financial_change() from public;
