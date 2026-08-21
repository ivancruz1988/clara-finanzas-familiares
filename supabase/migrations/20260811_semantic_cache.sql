create table if not exists public.ai_query_cache (
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

create table if not exists public.ai_query_runs (
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

alter table public.ai_query_cache enable row level security;
alter table public.ai_query_runs enable row level security;

create policy "members manage own ai query cache" on public.ai_query_cache
  for all using (public.is_household_member(household_id) and user_id = auth.uid())
  with check (public.is_household_member(household_id) and user_id = auth.uid());

create policy "members read own ai query runs" on public.ai_query_runs
  for select using (public.is_household_member(household_id) and user_id = auth.uid());

create policy "members insert own ai query runs" on public.ai_query_runs
  for insert with check (public.is_household_member(household_id) and user_id = auth.uid());

create unique index if not exists ai_query_cache_exact_idx
  on public.ai_query_cache(household_id,user_id,query_hash,data_version);

create index if not exists ai_query_cache_scope_idx
  on public.ai_query_cache(household_id,user_id,intent,data_version,expires_at);

create index if not exists ai_query_cache_embedding_idx
  on public.ai_query_cache using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create index if not exists ai_query_runs_scope_idx
  on public.ai_query_runs(household_id,user_id,created_at desc);

create trigger touch_ai_query_cache_updated_at
before update on public.ai_query_cache
for each row execute function public.touch_ai_document_updated_at();

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
