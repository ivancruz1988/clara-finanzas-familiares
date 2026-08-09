create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi familia',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  primary key (household_id, user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash','bank','wallet')),
  opening_balance numeric(14,2) not null default 0,
  color text not null default '#0b7254',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income','expense')),
  unique(household_id, name)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  category_id uuid references public.categories(id),
  transaction_date date not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null default 'expense' check (kind in ('income','expense')),
  transfer_group_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  due_date date not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text,
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  month date not null,
  planned_amount numeric(14,2) not null default 0,
  inflation_rate numeric(7,4),
  unique(household_id, category_id, month)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.monthly_budgets enable row level security;

create or replace function public.is_household_member(target uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.household_members where household_id = target and user_id = auth.uid());
$$;

create or replace function public.is_household_owner(target uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists(
    select 1 from public.household_members
    where household_id = target and user_id = auth.uid() and role = 'owner'
  );
$$;

-- The creator must become an owner automatically. Without this trigger the
-- first membership insert would be rejected by RLS because no owner exists yet.
create or replace function public.add_household_creator_as_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger household_creator_membership
after insert on public.households
for each row execute function public.add_household_creator_as_owner();

-- Authenticated clients use controlled RPCs for onboarding. This avoids an
-- INSERT ... RETURNING race with RLS before the owner membership is visible.
create or replace function public.current_household()
returns table (id uuid, name text, role text)
language sql security definer set search_path = public stable as $$
  select h.id, h.name, hm.role
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = auth.uid()
  order by h.created_at
  limit 1;
$$;

create or replace function public.create_household(household_name text)
returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  clean_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select h.id, h.name into new_id, clean_name
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = auth.uid()
  order by h.created_at
  limit 1;

  if new_id is not null then
    return query select new_id, clean_name;
    return;
  end if;

  clean_name := nullif(trim(household_name), '');
  if clean_name is null or length(clean_name) > 60 then
    raise exception 'Household name must contain between 1 and 60 characters';
  end if;

  insert into public.households (name, created_by)
  values (clean_name, auth.uid())
  returning households.id into new_id;

  return query select new_id, clean_name;
end;
$$;

revoke all on function public.current_household() from public;
revoke all on function public.create_household(text) from public;
grant execute on function public.current_household() to authenticated;
grant execute on function public.create_household(text) to authenticated;

create policy "members read households" on public.households for select using (public.is_household_member(id));
create policy "users create households" on public.households for insert with check (created_by = auth.uid());
create policy "members read memberships" on public.household_members for select using (public.is_household_member(household_id));
create policy "owners insert memberships" on public.household_members
  for insert with check (public.is_household_owner(household_id));
create policy "owners update memberships" on public.household_members
  for update using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));
create policy "owners delete memberships" on public.household_members
  for delete using (public.is_household_owner(household_id) and user_id <> auth.uid());

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','payment_orders','monthly_budgets'] loop
    execute format('create policy "members manage %1$s" on public.%1$I for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
  end loop;
end $$;

create index transactions_household_date_idx on public.transactions(household_id, transaction_date desc);
create index transactions_transfer_group_idx on public.transactions(transfer_group_id) where transfer_group_id is not null;
create index payments_household_due_idx on public.payment_orders(household_id, due_date, status);

create or replace function public.create_transfer(source_account uuid, destination_account uuid, transfer_date date, transfer_description text, transfer_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  source_household uuid;
  destination_household uuid;
  group_id uuid := gen_random_uuid();
  clean_description text := nullif(trim(transfer_description), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if source_account = destination_account then raise exception 'Accounts must be different'; end if;
  if transfer_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if transfer_date is null then raise exception 'Transfer date is required'; end if;
  if clean_description is null then clean_description := 'Transferencia entre cuentas'; end if;

  select household_id into source_household from public.accounts where id = source_account;
  select household_id into destination_household from public.accounts where id = destination_account;
  if source_household is null or source_household <> destination_household or not public.is_household_member(source_household) then
    raise exception 'Accounts must belong to the same household';
  end if;

  insert into public.transactions(household_id,account_id,transaction_date,description,amount,kind,transfer_group_id)
  values
    (source_household,source_account,transfer_date,clean_description,transfer_amount,'expense',group_id),
    (source_household,destination_account,transfer_date,clean_description,transfer_amount,'income',group_id);
  return group_id;
end;
$$;

revoke all on function public.create_transfer(uuid,uuid,date,text,numeric) from public;
grant execute on function public.create_transfer(uuid,uuid,date,text,numeric) to authenticated;
