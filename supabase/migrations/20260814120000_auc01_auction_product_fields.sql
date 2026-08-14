-- ============================================================================
-- AUC-01 / AUC-09 — the auction's PRODUCT half: name, description, image
--
-- ---------------------------------------------------------------------------
-- WHOSE WORK THIS IS
--
-- auctions is Mohammed's table (S0-11, TEAM.md §4) and this is Mohammed's half
-- of it — the product fields, as opposed to the bidding fields that
-- 20260812120000 created. It is written by Rayan at @RayanAlDwlah's explicit
-- direction as project owner, announced on #43 and #51 before a line of it
-- existed, and it is @m7ya505's to reject.
--
-- CLAUDE.md §1 says do not write code you do not own. That rule was raised
-- first and overridden by the owner, not quietly stepped around.
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION HAS TO EXIST AT ALL
--
-- main carries the entire bidding engine — place_bid, closing, winner
-- determination, the BR-36 extension — deployed and sweeping every 15 s. And
-- there is no way to create an auction, so none of it can be demonstrated.
--
-- FR-CREATE-01 requires five fields: image, name, description, starting price,
-- end time. Three of the five had no column. docs/contracts/S0-11-auction-record.md
-- is deliberately only Rayan's half — what bidding READS — and says so in §1.
--
-- NOTHING HERE IS AN INVENTED PRODUCT DECISION (TEAM.md rule 16). Every bound
-- below is quoted from the PRD:
--
--   FR-CREATE-04  name        required, 3–100 characters after trimming
--   FR-CREATE-05  description required, 10–2000 characters after trimming
--   FR-CREATE-15  exactly ONE image per auction
--   FR-CREATE-16  JPEG, PNG, WebP only
--   FR-CREATE-17  at most 5 MB
--   FR-CREATE-18  type validated server-side, not by extension
--
-- And nothing from the forbidden list: no reserve (BR-35), no price ceiling
-- (FR-CREATE-07, BR-21), no numeric(P,2) typmod, no second money formatter,
-- no bid increment. This migration does not touch a single money column.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The three product columns
--
-- NOT NULL, and no DEFAULT. A default product name would be an invented value
-- standing where a required field belongs, and it would let a nameless auction
-- exist — which FR-CREATE-01 forbids and FR-CREATE-03 ("no optional fields")
-- forbids twice. Both databases hold zero auctions (measured before writing
-- this), so NOT NULL is applied directly rather than through a backfill.
--
-- The length bounds are CHECK constraints rather than varchar(n) typmods: a
-- typmod TRUNCATES on cast in some paths, and a silently shortened description
-- is worse than a rejected one. FR-CREATE-12 requires rejection with a message.
--
-- `= btrim(...)` is the load-bearing half. Without it "   ab   " is 9
-- characters and passes a 3–100 check while carrying a 2-character name —
-- FR-CREATE-04 says the bounds apply AFTER trimming, so the stored value must
-- already be the trimmed one. The server trims before insert; this refuses
-- anything that did not.
-- ----------------------------------------------------------------------------
alter table public.auctions
  add column name        text not null,
  add column description text not null,
  add column image_path  text not null;

alter table public.auctions
  add constraint auctions_name_trimmed
    check (name = btrim(name)),
  add constraint auctions_name_length
    check (length(name) between 3 and 100),               -- FR-CREATE-04
  add constraint auctions_description_trimmed
    check (description = btrim(description)),
  add constraint auctions_description_length
    check (length(description) between 10 and 2000),      -- FR-CREATE-05
  -- image_path is a storage object KEY, never a URL. Storing a URL would let a
  -- listing render an arbitrary remote origin chosen by the seller.
  add constraint auctions_image_path_shape
    check (
      length(image_path) between 1 and 512
      and image_path !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'       -- no scheme: no http:, no data:
      and image_path !~ '^/'                              -- no absolute path
      and image_path !~ '\.\.'                            -- no traversal
    );

comment on column public.auctions.name        is 'FR-CREATE-04 — product name, 3–100 chars, stored already trimmed.';
comment on column public.auctions.description is 'FR-CREATE-05 — product description, 10–2000 chars, stored already trimmed.';
comment on column public.auctions.image_path  is 'FR-CREATE-15 — storage object key in the auction-images bucket. Exactly one image. Never a URL.';

-- ----------------------------------------------------------------------------
-- 2. The missing GRANT — the actual reason nothing could be created
--
-- 20260812120000 §3a already created the policy `auctions_owner_insert`, with
-- a WITH CHECK that pins owner to the session, forces status='active',
-- current_price=starting_price, a null outcome, and the 5-minute-to-7-day
-- window. It is complete and it has never once run.
--
-- Because RLS IS THE SECOND GATE, NEVER THE FIRST — the same sentence that
-- migration writes in its own comments. PostgreSQL checks the GRANT before it
-- evaluates any policy, and the grant on that line is `select` and nothing
-- else. An INSERT therefore dies at 42501 and the policy is never consulted.
-- Measured on dev before this line: no INSERT privilege for either role.
--
-- authenticated ONLY. Not anon: BR-01 ties every auction to a real account,
-- and the policy's `owner_id = auth.uid()` would be null for anon anyway —
-- but a grant that relies on a NULL comparison to stay shut is not a control.
-- ----------------------------------------------------------------------------
grant insert on public.auctions to authenticated;

-- Still no update and no delete for anyone. Immutability (BR-31, FR-SEC-04/09)
-- and no cancellation (BR-30) are the ABSENCE of a policy, and 20260812120000
-- revokes both. Restated here only so that reading this file cannot leave the
-- impression that adding INSERT loosened anything else.
revoke update, delete on public.auctions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Listing performance — AUC-09
--
-- FR-LIST-01 lists ACTIVE auctions ending soonest first. The filter is in the
-- query and not in the policy, deliberately: a status-filtered policy would
-- make ended auctions unreadable and break FR-END-12, which keeps them visible
-- forever. 20260812120000 §3a already says this; the index matches that shape.
--
-- Partial, on status='active'. The ended rows accumulate without bound and are
-- never listed, so they do not belong in the listing index.
-- ----------------------------------------------------------------------------
create index if not exists auctions_active_ending_soonest
  on public.auctions (end_time asc)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- 4. The image bucket — FR-CREATE-15 → FR-CREATE-18, SEC-V5
--
-- public = true: FR-DETAIL / AUC-06 require anonymous visitors to see the
-- product image, and BR-40 already makes auctions and bids anonymously
-- readable. The image carries no identity — the object key is the auction's,
-- and nothing in it names the seller.
--
-- file_size_limit and allowed_mime_types are enforced by storage-api on the
-- server, which is what FR-CREATE-18 and SEC-V5 ask for: "validated
-- server-side, not by file extension alone". The client-side check in the form
-- is fast feedback and is not the authority (SEC-V6).
-- ----------------------------------------------------------------------------
-- Guarded, on the same principle as 20260814000000's pg_cron block: the schema
-- objects below belong to Supabase's storage-api, and the bidding suite runs on
-- a stock postgres:17 container that has no `storage` schema. A stack without
-- storage loses image upload, never bidding correctness — so the suite must be
-- able to apply this file and keep going, rather than needing a second copy of
-- the migration that drifts.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'AUC-01: no storage schema — bucket and policies skipped (local test stack)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'auction-images',
    'auction-images',
    true,
    5242880,                                                -- 5 MB, FR-CREATE-17
    array['image/jpeg', 'image/png', 'image/webp']          -- FR-CREATE-16
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Storage policies. storage.objects has RLS enabled by Supabase already.
  --
  -- The upload policy pins the first path segment to the uploader's own id.
  -- That is what stops one authenticated user overwriting another's image:
  -- without it, any signed-in account could PUT over the object key of an
  -- auction it does not own, silently replacing the picture on someone else's
  -- listing.
  execute 'drop policy if exists auction_images_public_read on storage.objects';
  execute $p$
    create policy auction_images_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'auction-images')
  $p$;

  execute 'drop policy if exists auction_images_owner_insert on storage.objects';
  execute $p$
    create policy auction_images_owner_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'auction-images'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $p$;

  raise notice 'AUC-01: auction-images bucket ready (5 MB, jpeg/png/webp)';
end $$;

-- No update and no delete policy, for anyone.
--
-- SEC-I6 wants no orphaned image, and the instinct is to let the app delete on
-- failure. But a delete policy is also a delete policy for a SUCCEEDED
-- auction, and BR-31/BR-30 make a live auction's image as immutable as its
-- price — an auction whose picture can be swapped after bidding starts is a
-- different product. Orphan cleanup is AUC-05's problem and belongs in a
-- scheduled sweep that runs as the table owner, not in a user-facing grant.
-- The absence of these two policies is the requirement, exactly as it is on
-- bids and on auctions.

-- ----------------------------------------------------------------------------
-- 5. What this file deliberately does NOT do
--
--   - no create_auction() SECURITY DEFINER function. The insert policy above
--     already enforces every FR-CREATE invariant, and each definer function is
--     a permanent RLS bypass that has to be audited forever (§11.4). Two exist;
--     a third to duplicate a working policy would be a net loss.
--   - no auction edit, no cancel, no draft. BR-30, BR-31, BR-14.
--   - no seller-facing status column change of any kind.
--   - nothing touching place_bid, closing, the extension, or any money column.
-- ----------------------------------------------------------------------------
