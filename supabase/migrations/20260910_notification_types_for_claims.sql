-- ==============================================================================
-- NOTIFICATION TYPES FOR THE OPEN JOB BOARD
--
--   booking_confirmed  the Instagram DM telling the customer a detailer is
--                      locked in and the job is going ahead
--   job_unclaimed      the alert to the owner that a job has sat on the board
--                      for two hours with nobody taking it
--
-- Kept in its own file because Postgres will not let a new enum value be added
-- and then used inside the same transaction. This must run BEFORE
-- 20260910_open_job_board.sql, whose queues filter on both values.
-- ==============================================================================

alter type notification_type add value if not exists 'booking_confirmed';
alter type notification_type add value if not exists 'job_unclaimed';
