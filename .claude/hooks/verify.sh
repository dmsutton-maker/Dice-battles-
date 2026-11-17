#!/usr/bin/env bash
# Stop hook: verify the code before Claude finishes a turn.
#
# Runs the typecheck and the headless test suite (~6s together). On failure
# it blocks the turn and hands the output back so the regression gets fixed
# now, rather than reaching a kid's phone through the next EAS Update.
set -uo pipefail

input=$(cat 2>/dev/null || echo '{}')

# Claude Code sets stop_hook_active when it is already responding to this
# hook. Blocking again there would loop forever.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ -f package.json ] || exit 0

if output=$(npm run typecheck 2>&1 && npm test 2>&1); then
  exit 0
fi

# Keep the feedback small enough to be useful in context.
trimmed=$(printf '%s' "$output" | tail -60)
jq -n --arg out "$trimmed" '{
  decision: "block",
  reason: ("Verification failed after your changes. Fix this before finishing — do not loosen a test to make it pass.\n\n" + $out)
}'
