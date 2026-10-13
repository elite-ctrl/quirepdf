create table if not exists unlocks (
  id serial primary key,
  browser text not null,
  label text not null,
  agent text not null,
  seen_at timestamptz not null default now()
);

create index if not exists unlocks_browser_idx on unlocks (browser, seen_at desc);
