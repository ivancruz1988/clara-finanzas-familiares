create extension if not exists vector with schema extensions;

create table if not exists public.ai_documents (
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

create table if not exists public.ai_document_sections (
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

alter table public.ai_documents enable row level security;
alter table public.ai_document_sections enable row level security;

drop policy if exists "members read ai documents" on public.ai_documents;
drop policy if exists "members manage ai documents" on public.ai_documents;
drop policy if exists "members read ai sections" on public.ai_document_sections;
drop policy if exists "members manage ai sections" on public.ai_document_sections;

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

create index if not exists ai_documents_household_source_idx
  on public.ai_documents(household_id,source_type,source_id);

create index if not exists ai_document_sections_household_idx
  on public.ai_document_sections(household_id,document_id,section_index);

create index if not exists ai_document_sections_fts_idx
  on public.ai_document_sections using gin(fts);

create index if not exists ai_document_sections_embedding_idx
  on public.ai_document_sections using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create or replace function public.touch_ai_document_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_ai_documents_updated_at on public.ai_documents;
create trigger touch_ai_documents_updated_at
before update on public.ai_documents
for each row execute function public.touch_ai_document_updated_at();

drop trigger if exists touch_ai_document_sections_updated_at on public.ai_document_sections;
create trigger touch_ai_document_sections_updated_at
before update on public.ai_document_sections
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
