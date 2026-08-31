create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do update set email = excluded.email, updated_at = now();

create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  unique(payment_order_id, user_id, reminder_date)
);

alter table public.profiles enable row level security;
alter table public.payment_reminders enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "members read payment reminders" on public.payment_reminders;
create policy "members read payment reminders" on public.payment_reminders
  for select using (public.is_household_member(household_id));

create index if not exists payment_reminders_household_date_idx on public.payment_reminders(household_id, reminder_date desc);
create index if not exists payment_reminders_user_date_idx on public.payment_reminders(user_id, reminder_date desc);
