alter table public.users
  add column if not exists avatar_url text not null default '',
  add column if not exists cover_url text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists favorite_genres text not null default '[]';
