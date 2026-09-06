## HANDOFF — instructions for the model continuing this work

This review was run by Fable 5.1 and handed to Opus at 95% usage on 2026-09-06, at David's request, to save tokens. Everything needed is here or earlier in the conversation. The Expo and Vercel tokens are in the chat — use them from the environment only, never write them to disk.

Do these in order:

1. **Finish the review.** Run id `wf_82e1508f-191`. Count `"type":"result"` lines in `/root/.claude/projects/-home-user-Dice-battles-/e5070910-a4c9-5052-b188-05edc16ca70e/subagents/workflows/wf_82e1508f-191/journal.jsonl` — 35 means complete. If fewer, resume with `Workflow({scriptPath: "/root/.claude/projects/-home-user-Dice-battles-/e5070910-a4c9-5052-b188-05edc16ca70e/workflows/scripts/dice-battles-launch-review-wf_82e1508f-191.js", resumeFromRunId: "wf_82e1508f-191"})`. David asked for multi-agent orchestration in his own words, so this is within the opt-in even with ultracode off. If the scratchpad renders are missing, re-run `scratchpad/launch-review/render-all.sh` (it installs web packages, renders, and REMOVES them — never skip the removal).
2. **Regenerate this file as final:** `python3 tools/launch-review/extract-verdicts.py <journal> /tmp/verdicts.json && python3 tools/launch-review/make-handoff.py /tmp/verdicts.json LAUNCH_REVIEW.md "FINAL — all 35 review agents completed"`. Commit it.
3. **Fix section A, then A2, then B, in that order**, grouping edits to the same file. Run the ship procedure after each group. Look at every visual change through the real preview tools before shipping (project rule: visual work must be looked at). Do NOT act on sections C, D or E.
4. **Site fixes** (anything under `hq/`): also redeploy with the Vercel command below. The privacy policy and the app page are the App Review blockers — do those first of all.
5. **Then give David his list**: sections C and D rewritten as a plain numbered step-by-step, one action each, where to click, what to decide. Publish it as an Artifact page and summarise in chat. He asked for "an easy to follow step by step list for each thing I need to do or decide on".
6. The bug-board routine (`trig_01TtJdRSGx9JjmoeFt991K3F`, 7am/7pm ET) keeps firing into this session; answer it each time by querying `public.ideas where kind='bug'` on Supabase project `eqdbvpnckriscvzalwix`. The four existing bugs are all handled.
