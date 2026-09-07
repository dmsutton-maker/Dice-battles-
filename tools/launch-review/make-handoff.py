import json, sys, collections, datetime
src, out, status = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src))
LENS_RANK = {'TIEBREAKER': 3, 'skeptic': 2, 'SKEPTIC': 2}
# dedupe across lenses: one row per (area, what); prefer tiebreak > skeptic > impact
best = {}
for v in d['verify']:
    rank = LENS_RANK.get(v['lens'], 1)
    for it in v['items']:
        k = (v['area'], it['what'].strip())
        if k not in best or rank > best[k][0]:
            best[k] = (rank, v['area'], it)
rows = [b[2] | {'area': b[1]} for b in best.values()]
live = [r for r in rows if r['verdict'] in ('confirmed', 'partly')]
SEV = {'blocker': 0, 'major': 1, 'minor': 2, 'cosmetic': 3}
def sortkey(r): return (SEV[r['severity']], r['area'], {'small':0,'medium':1,'large':2}[r['effort']])
groups = collections.defaultdict(list)
for r in live: groups[r['fixClass']].append(r)
for g in groups.values(): g.sort(key=sortkey)
gfx = [it for g in d.get('graphics', []) for it in g['items']]
gfx_bad = [it for it in gfx if it['verdict'] != 'good' or not it['familySafe']]
tri = d.get('triage', [])
tri_auto = []
seen=set()
for t in tri:
    for it in t['items']:
        k=(t['area'], it['what'].strip())
        if k in seen: continue
        seen.add(k)
        if it['verdict'] in ('confirmed','partly') and it['fixClass']=='auto-fix': tri_auto.append(it | {'area': t['area']})
tri_auto.sort(key=sortkey)

L = []
L.append(f"# Launch review — handoff\n")
L.append(f"**Status: {status}.** Generated from the verifier verdicts in the launch-review workflow (run `wf_82e1508f-191`), not written by hand, so the fix instructions below are the verifiers' exact words.\n")
L.append(open(__file__.rsplit("/",1)[0] + "/HANDOFF.md").read())
L.append("""## How the review was done

- The nine-area map is at `scratchpad/launch-review/maps/*.json`; two independent verifiers judged every blocker and major, with a tiebreaker where they disagreed; an art director looked at fresh renders of all 16 themed arenas and 53 dice skins, under `scratchpad/launch-review/{arenas,dice}/`.
- Read `AGENTS.md` (the rules) and `STATE.md` (the facts) before touching anything.
- Sections A, A2 and B below are a RECORD of what was fixed, not a list of work outstanding. Sections C and D are the outstanding work, and both are David's.
""")

def emit(title, items, note=''):
    L.append(f"\n## {title} ({len(items)})\n")
    if note: L.append(note + "\n")
    for i, r in enumerate(items, 1):
        L.append(f"### {i}. [{r['severity']} · {r['effort']}] {r['area']}: {r['what'].strip()}\n")
        L.append(f"- **Evidence:** {r['evidence'].strip()}\n")
        L.append(f"- **Do this:** {r['fixInstruction'].strip()}\n")

emit("A. Fix these yourself — safe, no decision needed", groups.get('auto-fix', []),
     "Verified by two independent lenses (or a tiebreaker). Severity is the verifiers' launch calibration.")
if tri_auto:
    emit("A2. Minor and cosmetic fixes from the triage pass", tri_auto, "Lower stakes; still validated by an agent that opened the code.")
if gfx:
    L.append(f"\n## B. Graphics verdicts ({len(gfx)} renders judged; {len(gfx_bad)} need work)\n")
    for it in gfx_bad:
        L.append(f"- **{it['kind']} `{it['id']}` — {it['verdict']}{'' if it['familySafe'] else ' · NOT FAMILY SAFE'}:** {it['problem'].strip()}\n  - Fix: {it['fix'].strip()}\n")
    good = [it['id'] for it in gfx if it['verdict']=='good' and it['familySafe']]
    L.append(f"\nJudged good as-is: {', '.join(good)}\n")
else:
    L.append("\n## B. Graphics verdicts\n\nNot yet available — the art-director agents had not finished when this was generated. Resume the workflow to get them.\n")
emit("C. Needs David to DECIDE (ask, don't build)", groups.get('needs-decision', []))
emit("D. Needs David's HANDS (consoles, accounts, money)", groups.get('needs-owner-hands', []))
emit("E. Real but not worth doing before launch", groups.get('not-worth-it', []))
refuted = [r for r in rows if r['verdict']=='refuted']
L.append(f"\n## F. Refuted claims ({len(refuted)}) — do not act on these\n")
for r in refuted: L.append(f"- {r['area']}: {r['what'].strip()[:160]} — *{r['evidence'].strip()[:200]}*\n")
open(out, 'w').write('\n'.join(L))
print(f"wrote {out}: auto-fix={len(groups.get('auto-fix',[]))} triage-auto={len(tri_auto)} decide={len(groups.get('needs-decision',[]))} hands={len(groups.get('needs-owner-hands',[]))} skip={len(groups.get('not-worth-it',[]))} refuted={len(refuted)} gfx={len(gfx)}")
