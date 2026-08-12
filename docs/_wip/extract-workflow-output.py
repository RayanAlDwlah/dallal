#!/usr/bin/env python3
"""Recover agent output from the workflow journals AND transcripts of session
c9cb8706-0888-429d-a4a2-8cb2b7afcbd0. Safe to re-run; overwrites its outputs.

Two recovery paths, because the journal alone is not enough:
  (1) journal.jsonl 'result' entries — agents the workflow recorded normally.
  (2) agent-*.jsonl transcripts — agents that PRODUCED a full answer and then
      died (session limit / network) before the workflow recorded a result.
      wf_47dfc3cc-3f1's BID-02 document (51,727 chars) was recovered this way;
      the journal showed nothing for it.
"""
import json, os, glob

BASE = os.path.expanduser(
    '~/.claude/projects/-Users-ry7vv-Documents-Coding-Project-dllal/'
    'c9cb8706-0888-429d-a4a2-8cb2b7afcbd0/subagents/workflows')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WORKFLOWS = {'wf_47dfc3cc-3f1': ('s012', 'S0-12 money + BID-02 bid operation'),
             'wf_92526581-c39': ('s011', 'S0-11 auction record contract')}

# Text that means "died", not "answered".
DEAD = ('session limit', 'API Error:', 'output_config.effort')


def journal_results(wf):
    path = os.path.join(BASE, wf, 'journal.jsonl')
    if not os.path.exists(path):
        print('  missing journal:', path)
        return []
    acc = []
    for line in open(path):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'result':
            continue
        v = e.get('value')
        if v is None:
            v = e.get('result')
        if v is not None:
            acc.append(v)
    return acc


def transcript_texts(wf):
    """Longest real assistant text block per agent transcript."""
    out = {}
    for f in sorted(glob.glob(os.path.join(BASE, wf, 'agent-*.jsonl'))):
        best = ''
        for line in open(f):
            try:
                e = json.loads(line)
            except ValueError:
                continue
            m = e.get('message') or {}
            if m.get('role') != 'assistant' or not isinstance(m.get('content'), list):
                continue
            for b in m['content']:
                if b.get('type') == 'text':
                    t = b.get('text', '')
                    if len(t) > len(best) and not any(d in t for d in DEAD):
                        best = t
        if len(best) > 2000:                      # a real deliverable, not chatter
            out[os.path.basename(f)[6:23]] = best
    return out


for wf, (tag, label) in WORKFLOWS.items():
    rs = journal_results(wf)
    dicts = [r for r in rs if isinstance(r, dict)]
    strs = [r for r in rs if isinstance(r, str)]
    print(f'{wf} ({label})')
    print(f'  journal: {len(rs)} results ({len(dicts)} structured, {len(strs)} text)')

    json.dump(dicts, open(f'{OUT}/_wip/{tag}-structured.json', 'w'),
              indent=2, ensure_ascii=False)

    for i, s in enumerate(sorted(strs, key=len, reverse=True)):
        open(f'{OUT}/_wip/{tag}-markdown-{i}.md', 'w').write(s)
        print(f'  wrote _wip/{tag}-markdown-{i}.md ({len(s)} chars)')

    # Path (2): deliverables the journal never recorded.
    known = {s[:400] for s in strs}
    for aid, text in transcript_texts(wf).items():
        if text[:400] in known:
            continue
        dest = f'{OUT}/_wip/{tag}-unrecorded-{aid}.md'
        open(dest, 'w').write(text)
        head = text.lstrip().splitlines()[0][:70]
        print(f'  RECOVERED (absent from journal) _wip/{tag}-unrecorded-{aid}.md '
              f'({len(text)} chars) :: {head}')
