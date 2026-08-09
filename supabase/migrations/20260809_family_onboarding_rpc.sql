-- Atomic family onboarding for authenticated users.
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
