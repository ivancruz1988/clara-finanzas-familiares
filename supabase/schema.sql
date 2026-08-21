create extension if not exists vector with schema extensions;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi familia',
  created_by uuid not null references auth.users(id),
  data_version bigint not null default 0,
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
  idempotency_key text not null default gen_random_uuid()::text,
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
  paid_transaction_id uuid references public.transactions(id) on delete set null,
  idempotency_key text not null default gen_random_uuid()::text,
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

create table public.audit_events (
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

create table public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  source_type text not null check (source_type in ('help','receipt','transaction','payment','budget','note')),
  source_id uuid,
  title text not null,
  content_hash text not null,
  embedding_model text,
  embedding_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id,source_type,source_id,content_hash)
);

create table public.ai_document_sections (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  section_index integer not null,
  content text not null,
  content_hash text not null,
  token_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_version text,
  fts tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id,section_index)
);

create table public.ai_query_cache (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_query text not null,
  query_hash text not null,
  intent text not null,
  filters jsonb not null default '{}'::jsonb,
  answer_payload jsonb not null,
  source_ids uuid[] not null default '{}',
  embedding extensions.vector(1536),
  embedding_model text,
  embedding_version text,
  data_version bigint not null,
  expires_at timestamptz not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_query_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  intent text not null,
  filters jsonb not null default '{}'::jsonb,
  engine text not null,
  cache_kind text not null default 'miss' check (cache_kind in ('miss','exact','semantic','assist')),
  cache_similarity double precision,
  data_version bigint not null,
  latency_ms integer,
  source_count integer not null default 0,
  validation_status text not null default 'pending',
  estimated_cost numeric(12,6),
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.audit_events enable row level security;
alter table public.ai_documents enable row level security;
alter table public.ai_document_sections enable row level security;
alter table public.ai_query_cache enable row level security;
alter table public.ai_query_runs enable row level security;

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
create policy "members read audit events" on public.audit_events
  for select using (public.is_household_member(household_id));
create policy "members read ai documents" on public.ai_documents
  for select using (household_id is null or public.is_household_member(household_id));
create policy "members manage ai documents" on public.ai_documents
  for all using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
create policy "members read ai sections" on public.ai_document_sections
  for select using (household_id is null or public.is_household_member(household_id));
create policy "members manage ai sections" on public.ai_document_sections
  for all using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
create policy "members manage own ai query cache" on public.ai_query_cache
  for all using (public.is_household_member(household_id) and user_id = auth.uid())
  with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy "members read own ai query runs" on public.ai_query_runs
  for select using (public.is_household_member(household_id) and user_id = auth.uid());
create policy "members insert own ai query runs" on public.ai_query_runs
  for insert with check (public.is_household_member(household_id) and user_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','payment_orders','monthly_budgets'] loop
    execute format('create policy "members manage %1$s" on public.%1$I for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
  end loop;
end $$;

create index transactions_household_date_idx on public.transactions(household_id, transaction_date desc);
create index transactions_transfer_group_idx on public.transactions(transfer_group_id) where transfer_group_id is not null;
create unique index transactions_household_idempotency_idx on public.transactions(household_id,idempotency_key);
create index payments_household_due_idx on public.payment_orders(household_id, due_date, status);
create unique index payment_orders_household_idempotency_idx on public.payment_orders(household_id,idempotency_key);
create index audit_events_household_version_idx on public.audit_events(household_id,data_version desc);
create index ai_documents_household_source_idx on public.ai_documents(household_id,source_type,source_id);
create index ai_document_sections_household_idx on public.ai_document_sections(household_id,document_id,section_index);
create index ai_document_sections_fts_idx on public.ai_document_sections using gin(fts);
create index ai_document_sections_embedding_idx on public.ai_document_sections using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100) where embedding is not null;
create unique index ai_query_cache_exact_idx on public.ai_query_cache(household_id,user_id,query_hash,data_version);
create index ai_query_cache_scope_idx on public.ai_query_cache(household_id,user_id,intent,data_version,expires_at);
create index ai_query_cache_embedding_idx on public.ai_query_cache using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100) where embedding is not null;
create index ai_query_runs_scope_idx on public.ai_query_runs(household_id,user_id,created_at desc);

create or replace function public.touch_ai_document_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_ai_documents_updated_at
before update on public.ai_documents
for each row execute function public.touch_ai_document_updated_at();

create trigger touch_ai_document_sections_updated_at
before update on public.ai_document_sections
for each row execute function public.touch_ai_document_updated_at();

create trigger touch_ai_query_cache_updated_at
before update on public.ai_query_cache
for each row execute function public.touch_ai_document_updated_at();

create or replace function public.match_ai_document_sections(
  target_household uuid,
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  source_filter text default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    s.document_id,
    s.content,
    s.metadata,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.ai_document_sections s
  join public.ai_documents d on d.id = s.document_id
  where s.embedding is not null
    and (s.household_id = target_household or s.household_id is null)
    and (s.household_id is null or public.is_household_member(s.household_id))
    and (source_filter is null or d.source_type = source_filter)
  order by s.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

revoke all on function public.match_ai_document_sections(uuid,extensions.vector(1536),integer,text) from public;
grant execute on function public.match_ai_document_sections(uuid,extensions.vector(1536),integer,text) to authenticated;

create or replace function public.hybrid_search_ai_document_sections(
  target_household uuid,
  query_text text,
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  source_filter text default null,
  text_weight double precision default 0.5,
  vector_weight double precision default 0.5,
  rrf_k integer default 60
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  text_rank integer,
  vector_rank integer,
  text_score double precision,
  vector_score double precision,
  hybrid_score double precision
)
language sql stable security definer set search_path = public as $$
  with params as (
    select websearch_to_tsquery('spanish', coalesce(nullif(trim(query_text), ''), '')) as tsq
  ),
  candidates as (
    select
      s.id,
      s.document_id,
      s.content,
      s.metadata,
      ts_rank_cd(s.fts, params.tsq) as text_score_raw,
      case when s.embedding is null or query_embedding is null then null else 1 - (s.embedding <=> query_embedding) end as vector_score_raw,
      case when params.tsq = ''::tsquery then null else row_number() over (order by ts_rank_cd(s.fts, params.tsq) desc, s.id) end as text_rank,
      case when s.embedding is null or query_embedding is null then null else row_number() over (order by s.embedding <=> query_embedding, s.id) end as vector_rank
    from public.ai_document_sections s
    join public.ai_documents d on d.id = s.document_id
    cross join params
    where (s.household_id = target_household or s.household_id is null)
      and (s.household_id is null or public.is_household_member(s.household_id))
      and (source_filter is null or d.source_type = source_filter)
      and (
        (params.tsq <> ''::tsquery and s.fts @@ params.tsq)
        or (s.embedding is not null and query_embedding is not null)
      )
  )
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    c.text_rank::integer,
    c.vector_rank::integer,
    coalesce(text_weight/(rrf_k+c.text_rank),0)::double precision as text_score,
    coalesce(vector_weight/(rrf_k+c.vector_rank),0)::double precision as vector_score,
    (
      coalesce(text_weight/(rrf_k+c.text_rank),0) +
      coalesce(vector_weight/(rrf_k+c.vector_rank),0)
    )::double precision as hybrid_score
  from candidates c
  order by hybrid_score desc, c.id
  limit least(match_count, 20);
$$;

revoke all on function public.hybrid_search_ai_document_sections(uuid,text,extensions.vector(1536),integer,text,double precision,double precision,integer) from public;
grant execute on function public.hybrid_search_ai_document_sections(uuid,text,extensions.vector(1536),integer,text,double precision,double precision,integer) to authenticated;

create or replace function public.match_ai_query_cache(
  target_household uuid,
  target_user uuid,
  query_embedding extensions.vector(1536),
  target_intent text,
  target_filters jsonb,
  target_data_version bigint,
  min_similarity double precision default 0.94,
  match_count integer default 5
)
returns table (
  id uuid,
  answer_payload jsonb,
  source_ids uuid[],
  filters jsonb,
  data_version bigint,
  expires_at timestamptz,
  similarity double precision
)
language sql security definer set search_path = public stable as $$
  select
    c.id,
    c.answer_payload,
    c.source_ids,
    c.filters,
    c.data_version,
    c.expires_at,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.ai_query_cache c
  where auth.uid() = target_user
    and c.household_id = target_household
    and c.user_id = target_user
    and public.is_household_member(c.household_id)
    and c.embedding is not null
    and c.intent = target_intent
    and c.filters = target_filters
    and c.data_version = target_data_version
    and c.expires_at > now()
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 10);
$$;

revoke all on function public.match_ai_query_cache(uuid,uuid,extensions.vector(1536),text,jsonb,bigint,double precision,integer) from public;
grant execute on function public.match_ai_query_cache(uuid,uuid,extensions.vector(1536),text,jsonb,bigint,double precision,integer) to authenticated;

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
    jsonb_build_object('table',tg_table_name,'operation',tg_op,'at',now()),
    next_version
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','payment_orders','monthly_budgets'] loop
    execute format('create trigger audit_%1$s_changes after insert or update or delete on public.%1$I for each row execute function public.audit_financial_change()', t);
  end loop;
end $$;

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
