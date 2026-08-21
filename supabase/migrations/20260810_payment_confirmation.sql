alter table public.payment_orders
  add column if not exists paid_transaction_id uuid references public.transactions(id) on delete set null;

create or replace function public.confirm_payment_order(target_payment uuid, payment_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  payment_record public.payment_orders%rowtype;
  transaction_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into payment_record
  from public.payment_orders
  where id = target_payment
  for update;

  if payment_record.id is null then raise exception 'Payment order not found'; end if;
  if not public.is_household_member(payment_record.household_id) then raise exception 'Payment order not found'; end if;
  if payment_record.account_id is null then raise exception 'Payment order needs an origin account'; end if;

  if payment_record.status = 'paid' and payment_record.paid_transaction_id is not null then
    return payment_record.paid_transaction_id;
  end if;

  insert into public.transactions(household_id,account_id,category_id,transaction_date,description,amount,kind)
  values (
    payment_record.household_id,
    payment_record.account_id,
    payment_record.category_id,
    coalesce(payment_date,current_date),
    'Pago: ' || payment_record.description,
    payment_record.amount,
    'expense'
  )
  returning id into transaction_id;

  update public.payment_orders
  set status = 'paid',
      paid_at = now(),
      paid_transaction_id = transaction_id
  where id = payment_record.id;

  return transaction_id;
end;
$$;

revoke all on function public.confirm_payment_order(uuid,date) from public;
grant execute on function public.confirm_payment_order(uuid,date) to authenticated;
