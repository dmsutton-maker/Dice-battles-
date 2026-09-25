"""Pull every verifier / graphics / triage result out of the workflow journal into one JSON file.

    python3 tools/launch-review/extract-verdicts.py <journal.jsonl> <out.json>
"""
import json, sys
j, out = sys.argv[1], sys.argv[2]
verify, gfx, triage = [], [], []
for line in open(j):
    if not line.strip(): continue
    r = json.loads(line)
    if r.get('type') != 'result': continue
    v = r.get('result') or r.get('value')
    if not isinstance(v, dict) or 'items' not in v: continue
    # Triage agents DO carry a lens ("triage"), so they have to be
    # matched before the verify branch or they all land in `verify` —
    # which is what happened the first time this ran, and the reason the
    # handoff's minor section was empty.
    if v.get('lens') == 'triage': triage.append(v)
    elif 'lens' in v: verify.append(v)                     # verify + tiebreak
    elif v['items'] and 'kind' in v['items'][0]: gfx.append(v)   # graphics
    elif 'area' in v: triage.append(v)
json.dump({'verify': verify, 'graphics': gfx, 'triage': triage}, open(out, 'w'), indent=1)
print(f"verify={len(verify)} graphics={len(gfx)} triage={len(triage)} -> {out}")
