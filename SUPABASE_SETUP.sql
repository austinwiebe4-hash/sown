-- Bible Tracker — Supabase Setup
-- Run this in your Supabase SQL Editor

-- Table: chapters_read
create table if not exists chapters_read (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter integer not null,
  date_read date not null,
  created_at timestamptz default now()
);

-- Prevent duplicate entries for the same book+chapter
create unique index if not exists chapters_read_book_chapter_idx on chapters_read (book, chapter);

-- Table: verses
create table if not exists verses (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter integer not null,
  verse text not null,
  note text,
  theme text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (open read/write since there's no auth)
alter table chapters_read enable row level security;
alter table verses enable row level security;

create policy "Allow all" on chapters_read for all using (true) with check (true);
create policy "Allow all" on verses for all using (true) with check (true);
