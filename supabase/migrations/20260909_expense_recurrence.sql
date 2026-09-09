-- ==============================================================================
-- RECURRING EXPENSES
-- Costs that repeat on a schedule - ad spend, gas, insurance - rather than being
-- typed in again every week.
--
-- The recurrence lives ON the expense row instead of in a separate template
-- table, and no occurrence rows are ever written. A recurring expense is one
-- record that the Finance page expands into occurrences as it aggregates. That
-- means:
--   - editing the amount corrects every occurrence at once, which is what you
--     want when a monthly ad budget changes;
--   - there is no scheduled job that has to run for the figures to be right,
--     and so no way for the figures to silently drift because it did not;
--   - nothing accrues into the future. Expansion stops at today, so profit is
--     never charged for a cost that has not been incurred yet.
--
-- `date` is the first occurrence. recurrence_end is the last day it may repeat;
-- null means it is still running.
--
-- Idempotent: safe to run more than once.
-- ==============================================================================

begin;

do $blk$ begin
  create type expense_recurrence as enum ('none','weekly','monthly');
exception when duplicate_object then null;
end $blk$;

-- Defaults to 'none', so every expense that already exists stays a one-off and
-- the Finance figures are unchanged by this migration.
alter table expenses add column if not exists recurrence expense_recurrence not null default 'none';
alter table expenses add column if not exists recurrence_end date;

do $blk$ begin
  alter table expenses
    add constraint expenses_recurrence_end_after_start
    check (recurrence_end is null or recurrence_end >= date);
exception when duplicate_object then null;
end $blk$;

-- Partial: the index only has to answer "which expenses repeat", and that is a
-- small fraction of the table.
create index if not exists expenses_recurrence_idx on expenses (recurrence) where recurrence <> 'none';

commit;
