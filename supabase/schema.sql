create extension if not exists "uuid-ossp";

create table public.households (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash','bank')),
  opening_balance numeric(14,2) not null default 0,
  color text not null default '#0b7254',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income','expense')),
  unique(household_id, name)
);

create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  category_id uuid references public.categories(id),
  transaction_date date not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null default 'expense' check (kind in ('income','expense')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.payment_orders (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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

create policy "members read households" on public.households for select using (public.is_household_member(id));
create policy "users create households" on public.households for insert with check (created_by = auth.uid());
create policy "members read memberships" on public.household_members for select using (public.is_household_member(household_id));
create policy "owners manage memberships" on public.household_members for all using (exists(select 1 from public.household_members m where m.household_id=household_id and m.user_id=auth.uid() and m.role='owner'));

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','payment_orders','monthly_budgets'] loop
    execute format('create policy "members manage %1$s" on public.%1$I for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
  end loop;
end $$;

create index transactions_household_date_idx on public.transactions(household_id, transaction_date desc);
create index payments_household_due_idx on public.payment_orders(household_id, due_date, status);
