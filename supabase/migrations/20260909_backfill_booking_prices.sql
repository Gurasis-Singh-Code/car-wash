-- ==============================================================================
-- BACKFILL MISSING BOOKING PRICES
-- 28 bookings carried no price, 24 of them completed, so that work was invisible
-- to every revenue figure on the Finance page. This fills what can be filled
-- from the business's own pricing history.
--
-- BASIS: the LOWEST price ever charged for that service and vehicle type, per
-- car. Chosen deliberately over the average so the result can only understate
-- revenue, never inflate it - the point is a floor that is definitely earned,
-- not a guess that might flatter the numbers.
--
-- Prices are per car and multiplied by car_count. That is how the existing rows
-- already work: every multi-car booking in the table is exactly car_count times
-- the single-car price for the same service and vehicle.
--
-- TWO ROWS FALL BACK A LEVEL. full_gold on a mini truck and interior_gold on
-- "other" have no price history for that vehicle type, so they take the lowest
-- price ever charged for the SERVICE across all vehicles ($130 and $100). Both
-- are the cheapest vehicle class for that service, so this stays a floor.
--
-- interior_silver had never been priced on ANY booking, so there was nothing to
-- derive from. Rather than invent a number, those five completed sedan jobs were
-- left null until the owner supplied the real rate: $80 per car. That is the one
-- figure here that is a quoted price rather than an observed floor.
--
-- Idempotent: only touches rows where price IS NULL, so re-running it cannot
-- overwrite a real quote or a later correction.
-- ==============================================================================

begin;

with floors(svc, ct, per_car) as (
  values ('full_gold','sedan',130::numeric),
         ('full_gold','suv',150),
         ('full_gold','mini_truck',130),   -- service floor; no mini truck history
         ('interior_gold','sedan',100),
         ('interior_gold','other',100)     -- service floor; no "other" history
)
update bookings b
set price = f.per_car * greatest(b.car_count, 1)
from floors f
where b.price is null
  and f.svc = b.service::text
  and f.ct = b.car_type::text;

-- Supplied by the owner rather than derived: Interior Silver on a sedan is $80.
update bookings
set price = 80 * greatest(car_count, 1)
where price is null
  and service::text = 'interior_silver'
  and car_type::text = 'sedan';

commit;

-- Result when first run: 28 rows priced in total.
-- Completed revenue went from $2,690.00 to $5,800.00, and no booking in the
-- table is left without a price.
