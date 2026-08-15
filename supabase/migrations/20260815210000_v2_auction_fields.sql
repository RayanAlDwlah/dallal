-- ============================================================================
-- V2 — auction gains a category, a gallery, optional attributes, and the
-- seller-set fixed bid increment. ALL ADDITIVE: every V1 row keeps working
-- with every column here NULL/empty, and every V1 code path is untouched.
--
--   bid_increment IS NULL      -> V1 auction, legacy open-amount bidding
--                                 (place_bid, any amount above current — BR-32)
--   bid_increment IS NOT NULL  -> V2 auction, one-button fixed-increment
--                                 bidding (place_bid_v2; the server computes
--                                 the only legal amount)
--
-- The mode is decided at creation and IMMUTABLE — changing the increment
-- mid-auction would change the meaning of every bid before it.
-- ============================================================================

alter table public.auctions
  add column category_id integer references public.categories (id),
  add column bid_increment public.sar_amount,
  add column extra_image_paths jsonb not null default '[]'::jsonb,
  add column attributes jsonb not null default '{}'::jsonb;

-- The increment is whole SAR and a multiple of 10 (V2 product decision:
-- presets are 10/50/100/500/1000/5000 or a custom multiple of 10). The
-- sar_amount domain already guarantees > 0, finite, <= 2 decimals.
alter table public.auctions
  add constraint auctions_increment_shape
  check (bid_increment is null
         or (bid_increment = round(bid_increment, 0)
             and mod(bid_increment, 10) = 0));

-- The gallery: up to 9 EXTRA storage keys beside image_path (the cover).
-- Same key rules image_path enforces: relative storage keys, never URLs.
alter table public.auctions
  add constraint auctions_extra_images_shape
  check (jsonb_typeof(extra_image_paths) = 'array'
         and jsonb_array_length(extra_image_paths) <= 9);

alter table public.auctions
  add constraint auctions_attributes_shape
  check (jsonb_typeof(attributes) = 'object');

comment on column public.auctions.bid_increment is
  'V2 fixed increment (whole SAR, multiple of 10), set by the seller at creation, immutable. NULL = V1 legacy open-amount auction.';
comment on column public.auctions.extra_image_paths is
  'V2 gallery: up to 9 extra storage keys in auction-images. image_path stays the cover. Keys only, never URLs.';

create index auctions_category_active
  on public.auctions (category_id, end_time)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- Guard: the new creation-time terms join the immutable list. Everything the
-- guard already enforced (end_time single door + 30s quantum + counter
-- lockstep, terminal ended) is REPEATED VERBATIM from 20260814000000 — this
-- is CREATE OR REPLACE, so this file becomes the live definition.
-- ----------------------------------------------------------------------------
create or replace function public.auctions_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id       is distinct from old.owner_id
     or new.starting_price is distinct from old.starting_price
     or new.created_at  is distinct from old.created_at
     or new.category_id is distinct from old.category_id
     or new.bid_increment is distinct from old.bid_increment then
    raise exception 'auction creation-time terms are immutable (BR-31, BR-16, FR-SEC-09)';
  end if;

  if new.end_time is distinct from old.end_time then
    if coalesce(current_setting('dalal.in_place_bid', true), '') <> 'on' then
      raise exception 'the end time may only be extended by place_bid (BR-36 as amended)';
    end if;
    if new.end_time <> old.end_time + interval '30 seconds' then
      raise exception 'the end time may only move forward by exactly 30 seconds (BR-36 as amended)';
    end if;
    if new.extension_count <> old.extension_count + 1 then
      raise exception 'an end-time extension must increment extension_count by exactly 1 (BR-36 as amended)';
    end if;
  elsif new.extension_count is distinct from old.extension_count then
    raise exception 'extension_count may only change together with the end time (BR-36 as amended)';
  end if;

  if old.status = 'ended' then
    raise exception 'ended auctions are terminal; outcomes are immutable (BR-15, NFR-DAT-07)';
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- next_offer — the ONE number the V2 button shows, computed in SQL and
-- returned as canonical scale-2 TEXT (S0-12 §6: an amount never travels as a
-- JSON number). PostgREST exposes a single-row-argument function as a
-- computed column: GET /auctions?select=*,next_offer works.
-- NULL on a V1 auction (the button does not exist there).
-- ----------------------------------------------------------------------------
create function public.next_offer(a public.auctions)
returns text
language sql stable
set search_path = ''
as $$
  select case
    when a.bid_increment is null then null
    when not exists (select 1 from public.bids b where b.auction_id = a.id)
      then public.sar_text(a.starting_price)
    else public.sar_text(a.current_price + a.bid_increment)
  end
$$;

grant execute on function public.next_offer(public.auctions) to anon, authenticated;
