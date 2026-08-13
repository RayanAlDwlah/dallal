#!/usr/bin/env python3
"""Extract the migration SQL from docs/contracts/BID-02-bid-operation.md.

Why the SQL is extracted rather than committed as supabase/migrations/*.sql:
S0-11 (the auction record contract) is still awaiting Mohammed's sign-off, and
BID-02's §1c declares the `auctions` table. Committing that as a migration would
freeze a shape the record's owner has not agreed to yet — exactly the kind of
unilateral decision TEAM.md rule 16 forbids.

So the contract stays the single source, and these tests read from it. The day
S0-11 comes back ticked, the blocks move to supabase/migrations/ and this file
is deleted.

Usage:  python3 extract-sql.py <output-dir>
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONTRACT = os.path.normpath(
    os.path.join(HERE, '..', '..', '..', 'docs', 'contracts',
                 'BID-02-bid-operation.md'))

# Order matters: schema, then the function, then RLS, then the seed.
BLOCKS = ['01-schema.sql', '02-function.sql', '03-rls.sql', '04-seed.sql']


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    if not os.path.exists(CONTRACT):
        sys.exit(f'contract not found: {CONTRACT}')

    text = open(CONTRACT).read()
    sql = [body for lang, body in
           re.findall(r'```(\w+)\n(.*?)```', text, re.S) if lang == 'sql']

    if len(sql) < len(BLOCKS):
        sys.exit(f'expected at least {len(BLOCKS)} sql blocks, found {len(sql)}. '
                 'Did the contract change shape?')

    os.makedirs(out, exist_ok=True)
    for name, body in zip(BLOCKS, sql):
        path = os.path.join(out, name)
        open(path, 'w').write(body)
        print(f'  {name:<18} {len(body):>6} bytes')


if __name__ == '__main__':
    main()
