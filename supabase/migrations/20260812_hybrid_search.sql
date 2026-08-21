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
