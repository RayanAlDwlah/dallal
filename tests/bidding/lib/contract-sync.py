#!/usr/bin/env python3
"""Keep the committed migration and the BID-02 contract from drifting apart.

Until now this file extracted the SQL from docs/contracts/BID-02-bid-operation.md
and the suite ran against the extract, because S0-11 (the auction record) had not
been signed off and committing `auctions` as a migration would have frozen a shape
its owner had not agreed to.

The migration is now committed — as a REVIEW ARTEFACT, on a branch, in a PR that
is explicitly blocked on that sign-off. Nothing about the ownership question is
settled by this file existing; see the PR body. What changed is only that Mohammed
and Abdulrahman can now read the exact bytes that would be applied, instead of
signing off on a description of them.

That creates a new failure mode: two copies of the same SQL, and a suite that
would keep passing while they diverged. So this script now does the opposite of
what it used to.

  1. It ASSERTS that the migration is character-for-character the concatenation
     of the contract's first three ```sql blocks, in order. If they differ, the
     suite stops. Edit one, you must edit the other.
  2. It extracts ONLY the fourth block — the V-1 seed — which is test-only and
     deliberately absent from the migration: it writes auth.users directly with
     reserved UUIDs, which the product never does.

run.sh then applies the committed migration itself, so the suite proves the
artefact that would ship rather than a copy of it.

Usage:  python3 contract-sync.py <output-dir>
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
CONTRACT = os.path.join(ROOT, 'docs', 'contracts', 'BID-02-bid-operation.md')
MIGRATION = os.path.join(ROOT, 'supabase', 'migrations',
                         '20260812120000_bid02_bid_acceptance.sql')

# The contract's ```sql blocks, in document order. The first three concatenate
# into the migration — BID-02 §1: "sections 1-3 concatenate into this one
# migration, in order". The fourth is the V-1 seed and MUST NOT.
MIGRATION_BLOCKS = 3
SEED = '04-seed.sql'


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    for path in (CONTRACT, MIGRATION):
        if not os.path.exists(path):
            sys.exit(f'not found: {path}')

    text = open(CONTRACT, encoding='utf-8').read()
    sql = [body for lang, body in
           re.findall(r'```(\w+)\n(.*?)```', text, re.S) if lang == 'sql']

    if len(sql) < MIGRATION_BLOCKS + 1:
        sys.exit(f'expected at least {MIGRATION_BLOCKS + 1} sql blocks in the '
                 f'contract, found {len(sql)}. Did it change shape?')

    want = ''.join(sql[:MIGRATION_BLOCKS])
    got = open(MIGRATION, encoding='utf-8').read()

    if got != want:
        # Report the first differing line, not a byte offset: the point is to
        # send whoever hit this to the right place in both files.
        w, g = want.splitlines(), got.splitlines()
        n = next((i for i in range(max(len(w), len(g)))
                  if w[i:i + 1] != g[i:i + 1]), 0)
        sys.exit(
            'DRIFT: the committed migration is no longer the contract.\n'
            '  contract:  docs/contracts/BID-02-bid-operation.md '
            f'(first {MIGRATION_BLOCKS} sql blocks)\n'
            f'  migration: supabase/migrations/{os.path.basename(MIGRATION)}\n'
            f'  first difference at line {n + 1}:\n'
            f'    contract  {(w[n:n + 1] or ["<end of file>"])[0]!r}\n'
            f'    migration {(g[n:n + 1] or ["<end of file>"])[0]!r}\n'
            '  These are one artefact in two places. Change both, or change the '
            'contract and regenerate.')

    print(f'  migration == contract  {len(got):>6} chars, '
          f'{MIGRATION_BLOCKS} blocks, no drift')

    os.makedirs(out, exist_ok=True)
    seed = sql[MIGRATION_BLOCKS]
    open(os.path.join(out, SEED), 'w', encoding='utf-8').write(seed)
    print(f'  {SEED:<18}    {len(seed):>6} chars  '
          '(test-only, deliberately not in the migration)')


if __name__ == '__main__':
    main()
