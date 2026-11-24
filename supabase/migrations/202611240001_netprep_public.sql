create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  paper text not null check (paper in ('PAPER_1','PAPER_2')),
  unit_number integer not null,
  unit_name text not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text not null,
  source_type text not null check (source_type in ('PYQ','AI')),
  exam_year integer,
  exam_session text,
  question_id text unique,
  created_at timestamptz not null default now()
);

alter table public.questions
  add column if not exists paper text,
  add column if not exists unit_name text,
  add column if not exists option_a text,
  add column if not exists option_b text,
  add column if not exists option_c text,
  add column if not exists option_d text,
  add column if not exists question_id text;

update public.questions
set paper = case when unit_number between 101 and 110 then 'PAPER_1' else 'PAPER_2' end
where paper is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'options'
  ) then
    update public.questions
    set
      option_a = coalesce(option_a, options->>'A'),
      option_b = coalesce(option_b, options->>'B'),
      option_c = coalesce(option_c, options->>'C'),
      option_d = coalesce(option_d, options->>'D')
    where options is not null;
  end if;
end $$;

update public.questions
set unit_name = case unit_number
  when 101 then 'Teaching Aptitude'
  when 102 then 'Research Aptitude'
  when 103 then 'Comprehension'
  when 104 then 'Communication'
  when 105 then 'Mathematical Reasoning and Aptitude'
  when 106 then 'Logical Reasoning'
  when 107 then 'Data Interpretation'
  when 108 then 'Information and Communication Technology (ICT)'
  when 109 then 'People, Development and Environment'
  when 110 then 'Higher Education System'
  when 1 then 'Discrete Structures and Optimization'
  when 2 then 'Computer System Architecture'
  when 3 then 'Programming Languages and Computer Graphics'
  when 4 then 'Database Management Systems'
  when 5 then 'System Software and Operating System'
  when 6 then 'Software Engineering'
  when 7 then 'Data Structures and Algorithms'
  when 8 then 'Theory of Computation and Compilers'
  when 9 then 'Data Communication and Computer Networks'
  when 10 then 'Artificial Intelligence (AI)'
  else coalesce(unit_name, 'UGC NET Unit')
end
where unit_name is null;

create table if not exists public.daily_quizzes (
  quiz_date date primary key,
  question_ids uuid[] not null,
  created_at timestamptz not null default now()
);

alter table public.daily_quizzes add column if not exists question_ids uuid[];

create table if not exists public.publication_history (
  question_id uuid primary key references public.questions(id) on delete cascade,
  published_date date not null
);

alter table public.publication_history add column if not exists published_date date;

create index if not exists questions_paper_unit_idx on public.questions(paper, unit_number);
create index if not exists questions_source_idx on public.questions(source_type);
create index if not exists questions_year_idx on public.questions(exam_year);
create index if not exists questions_created_idx on public.questions(created_at desc);

alter table public.questions enable row level security;
alter table public.daily_quizzes enable row level security;
alter table public.publication_history enable row level security;

drop policy if exists "public read questions" on public.questions;
create policy "public read questions" on public.questions
  for select to anon, authenticated using (true);

drop policy if exists "public read daily quizzes" on public.daily_quizzes;
create policy "public read daily quizzes" on public.daily_quizzes
  for select to anon, authenticated using (true);

drop policy if exists "public read publication history" on public.publication_history;
create policy "public read publication history" on public.publication_history
  for select to anon, authenticated using (true);
