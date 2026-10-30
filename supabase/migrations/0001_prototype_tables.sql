-- NODI 공개 프로토타입 결과 저장소 (Supabase / PostgreSQL)
-- 원칙: 이름·이메일·대화 원문·캘린더 내용·IP는 저장하지 않아요. 피드백 자유 의견만 별도 컬럼(최대 300자)에 둬요.
-- 접근: 이 테이블은 서버(service-role 키)만 읽고 써요. RLS를 켜고 정책을 만들지 않아서 anon·authenticated 키로는 아무것도 못 해요.

create table if not exists public.prototype_runs (
  run_id uuid primary key,
  completed boolean not null,
  last_step text not null,
  total_ms integer not null check (total_ms >= 0),
  recommendation_count integer not null check (recommendation_count >= 0),
  regenerate_count integer not null check (regenerate_count >= 0),
  error_codes text[] not null default '{}',
  app_version text not null,
  flow_version text not null,
  experiment_id text not null,
  experiment_variant text not null,
  test_mode text not null check (test_mode = 'fictional_calendar'),
  device_category text not null check (device_category in ('mobile', 'tablet', 'desktop')),
  consent_policy_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prototype_feedback (
  run_id uuid primary key,                      -- 한 실행당 피드백 1건(중복 제출 방지)
  overall_score smallint not null check (overall_score between 1 and 5),
  ease_score smallint not null check (ease_score between 1 and 5),
  tags text[] not null default '{}',
  comment text check (comment is null or char_length(comment) <= 300),
  app_version text not null,
  flow_version text not null,
  experiment_id text not null,
  experiment_variant text not null,
  test_mode text not null check (test_mode = 'fictional_calendar'),
  device_category text not null check (device_category in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);

alter table public.prototype_runs enable row level security;
alter table public.prototype_feedback enable row level security;
-- 정책을 일부러 만들지 않아요: service-role 키는 RLS를 우회하고, 그 외 키는 모두 거부돼요.
revoke all on public.prototype_runs, public.prototype_feedback from anon, authenticated;
