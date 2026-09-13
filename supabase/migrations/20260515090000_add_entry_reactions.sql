create table if not exists entry_reactions (
  id serial primary key,
  entry_id integer not null references entries(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_reactions_value_check check (value in (-1, 1)),
  constraint entry_reactions_entry_id_user_id_key unique (entry_id, user_id)
);

create index if not exists entry_reactions_user_id_idx on entry_reactions(user_id);
create index if not exists entry_reactions_entry_id_value_idx on entry_reactions(entry_id, value);
