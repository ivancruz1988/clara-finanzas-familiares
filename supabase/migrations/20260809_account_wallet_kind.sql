alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts
  add constraint accounts_kind_check check (kind in ('cash', 'bank', 'wallet'));
