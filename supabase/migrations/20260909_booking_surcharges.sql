-- ==============================================================================
-- BOOKING SURCHARGES
-- The engine bay (+$30) and out-of-area (+$20) extras existed only as rules the
-- Instagram agent was told to quote. Nothing recorded whether a given job
-- actually had one, so the work was invisible to the schedule and the money was
-- invisible to revenue unless somebody happened to fold it into the total.
--
-- STORED AS AMOUNTS, NOT FLAGS. A boolean plus a rate constant in the code would
-- mean that raising the engine bay to $35 next year silently rewrites what every
-- past job was billed. Keeping the amount on the row makes the history true.
--
-- THREE STATES, and they are genuinely different:
--   null  the surcharge does not apply to this booking
--   0     it applies - the detailer must do the engine bay - but it was waived
--   > 0   it applies and this is what was charged
--
-- THESE ADD TO price. `price` is the base for the service; what the customer
-- pays is price + engine_bay_fee + out_of_area_fee, computed in one place
-- (bookingTotal() in types/booking.ts) so the cards, the detailer app and the
-- Finance revenue can never add it up differently. Existing rows get null and
-- so are completely unaffected.
--
-- Idempotent: safe to run more than once.
-- ==============================================================================

begin;

alter table bookings add column if not exists engine_bay_fee numeric;
alter table bookings add column if not exists out_of_area_fee numeric;

do $blk$ begin
  alter table bookings add constraint bookings_engine_bay_fee_non_negative
    check (engine_bay_fee is null or engine_bay_fee >= 0);
exception when duplicate_object then null;
end $blk$;

do $blk$ begin
  alter table bookings add constraint bookings_out_of_area_fee_non_negative
    check (out_of_area_fee is null or out_of_area_fee >= 0);
exception when duplicate_object then null;
end $blk$;

commit;
