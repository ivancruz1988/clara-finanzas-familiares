alter table public.transactions add column if not exists transfer_group_id uuid;
create index if not exists transactions_transfer_group_idx on public.transactions(transfer_group_id) where transfer_group_id is not null;

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
  if source_household is null or source_household <> destination_household or not public.is_household_member(source_household) then raise exception 'Accounts must belong to the same household'; end if;
  insert into public.transactions(household_id,account_id,transaction_date,description,amount,kind,transfer_group_id)
  values (source_household,source_account,transfer_date,clean_description,transfer_amount,'expense',group_id),(source_household,destination_account,transfer_date,clean_description,transfer_amount,'income',group_id);
  return group_id;
end;
$$;

revoke all on function public.create_transfer(uuid,uuid,date,text,numeric) from public;
grant execute on function public.create_transfer(uuid,uuid,date,text,numeric) to authenticated;
