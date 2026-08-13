# ============================================================================
# Keep the committed migration and the BID-02 contract from drifting apart.
#
# Reads docs/contracts/BID-02-bid-operation.md and writes two files:
#
#   expected.sql   the first three ```sql blocks concatenated, in order — what
#                  supabase/migrations/20260812120000_bid02_bid_acceptance.sql
#                  must be, character for character. run.sh diffs them and
#                  stops if they differ. (BID-02 §1: "sections 1-3 concatenate
#                  into this one migration, in order".)
#   04-seed.sql    the fourth block — V-1's fixtures. Deliberately NOT in the
#                  migration: it inserts into auth.users directly with reserved
#                  UUIDs, which the product never does.
#
# Why awk and not Python. @Dem4t reported on PR #1 that python3 is not on his
# machine, so the suite would not run for him — and PR #5 asks him to review a
# migration whose only evidence is that suite. A test runner that one of three
# developers cannot execute is not a test runner. awk is POSIX and is already
# wherever bash and docker are. This file now has no dependency the shell
# script does not already have.
#
# Usage:  awk -v out=DIR -f contract-sync.awk CONTRACT
# ============================================================================
BEGIN { n = 0; inblock = 0 }

# A fence while we are inside an sql block closes it. Same rule the Python
# version used, so the block boundaries cannot shift under the rename.
inblock && /^```/ { inblock = 0; next }
inblock           { body[n] = body[n] $0 "\n"; next }

/^```sql$/ { n++; body[n] = ""; inblock = 1; next }

END {
  if (inblock) {
    print "contract-sync: unterminated ```sql block (" n ")" > "/dev/stderr"
    exit 1
  }
  if (n < 4) {
    print "contract-sync: expected at least 4 sql blocks in the contract, " \
          "found " n ". Did it change shape?" > "/dev/stderr"
    exit 1
  }

  expected = out "/expected.sql"
  seed     = out "/04-seed.sql"
  printf "" > expected
  for (i = 1; i <= 3; i++) printf "%s", body[i] >> expected
  printf "%s", body[4] > seed
  close(expected); close(seed)

  printf "  %d sql blocks: 1-3 -> the migration, 4 -> the test-only seed\n", n
}
