#!/usr/bin/env bash
#
# Put Dice Battles on an iPhone Duo-shaped screen, on a Mac with Xcode.
#
# Run it from the top of the repo:
#
#     bash tools/duo-sim/run.sh
#
# It finds (or improvises) a simulator the size of Apple's folding phone,
# boots it, and tells you what to run next. It changes nothing in the repo
# and nothing about your Xcode install.
#
# Why a script: the folded Duo is 474x696pt and the unfolded one 640x904pt,
# and neither is a size the Simulator offers by name unless Xcode has
# shipped the device. Working out whether it has, and what to do when it
# has not, is fiddly to explain and quick to automate.

set -u

FOLDED_W=474; FOLDED_H=696
UNFOLDED_W=640; UNFOLDED_H=904

say() { printf '%s\n' "$*"; }
rule() { printf '\n%s\n\n' "------------------------------------------------------------"; }

if ! command -v xcrun >/dev/null 2>&1; then
  say "Xcode's command line tools are not installed."
  say "Open Terminal and run:  xcode-select --install"
  exit 1
fi

if ! xcrun simctl help >/dev/null 2>&1; then
  say "Xcode is installed but not selected. Run:"
  say "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

# The newest installed iOS runtime.
RUNTIME=$(xcrun simctl list runtimes --json \
  | python3 -c 'import json,sys
rs=[r for r in json.load(sys.stdin)["runtimes"] if r.get("isAvailable") and "iOS" in r["name"]]
rs.sort(key=lambda r: [int(n) for n in r["version"].split(".")])
print(rs[-1]["identifier"] if rs else "")')

if [ -z "$RUNTIME" ]; then
  say "No iOS simulator runtime is installed."
  say "Open Xcode, then Settings -> Components, and download an iOS Simulator."
  exit 1
fi
say "Using runtime: $RUNTIME"

TYPES=$(xcrun simctl list devicetypes)

# 1. Has Xcode shipped the real thing yet?
DUO=$(printf '%s\n' "$TYPES" | grep -i -E 'duo|fold' | head -1)
# 2. Failing that, the resizable iPhone, whose window you drag to any size.
RESIZABLE=$(printf '%s\n' "$TYPES" | grep -i 'resizable' | grep -i 'iphone' | head -1)

pick_id() { printf '%s\n' "$1" | sed -n 's/.*(\(com\.apple\.CoreSimulator\.SimDeviceType\.[^)]*\)).*/\1/p'; }

if [ -n "$DUO" ]; then
  NAME="Dice Battles Duo"
  TYPE_ID=$(pick_id "$DUO")
  MODE=real
  say "Xcode has a folding-phone simulator: $DUO"
elif [ -n "$RESIZABLE" ]; then
  NAME="Dice Battles Duo Stand-In"
  TYPE_ID=$(pick_id "$RESIZABLE")
  MODE=resizable
  say "No folding-phone simulator in this Xcode. Using the resizable iPhone,"
  say "whose window you drag to whatever size you like: $RESIZABLE"
else
  rule
  say "This Xcode has neither a folding-phone simulator nor a resizable one."
  say "Update Xcode (App Store -> Updates), or use any iPhone simulator and"
  say "accept that the shape will be wrong."
  exit 1
fi

if [ -z "$TYPE_ID" ]; then
  say "Could not read the simulator's id out of Xcode's list. Not fatal —"
  say "open Simulator yourself and pick the device by hand."
  exit 1
fi

UDID=$(xcrun simctl list devices --json \
  | NAME="$NAME" python3 -c 'import json,os,sys
want=os.environ["NAME"]
for ds in json.load(sys.stdin)["devices"].values():
    for d in ds:
        if d["name"]==want:
            print(d["udid"]); sys.exit()')

if [ -z "$UDID" ]; then
  say "Creating a simulator called \"$NAME\"..."
  UDID=$(xcrun simctl create "$NAME" "$TYPE_ID" "$RUNTIME") || {
    say "Could not create it. The runtime and the device may not go together."
    exit 1
  }
fi
say "Simulator: $NAME  ($UDID)"

xcrun simctl boot "$UDID" >/dev/null 2>&1
open -a Simulator

rule
say "NEXT, in this same Terminal window:"
say ""
say "    npx expo run:ios --device \"$NAME\""
say ""
say "The first build takes a while — ten to twenty minutes is normal, because"
say "it compiles every native library from scratch. After that it is seconds."
rule

if [ "$MODE" = resizable ]; then
  say "TO GET THE DUO'S SHAPE: drag the corner of the simulator window."
  say ""
  say "The game shows its own size in the top-left corner while it is running"
  say "from your Mac (it never shows that to a player). Drag until it reads:"
  say ""
  say "    ${FOLDED_W} x ${FOLDED_H} pt      iPhone Duo (folded)"
  say "    ${UNFOLDED_W} x ${UNFOLDED_H} pt      iPhone Duo (unfolded)"
  say ""
  say "Dragging between the two is the fold itself, which is the interesting"
  say "part: everything should move as you drag, not after you let go."
else
  say "The device folds from Simulator's Features or Hardware menu."
  say "The game shows its own size in the top-left corner; folded should read"
  say "${FOLDED_W} x ${FOLDED_H} pt and unfolded ${UNFOLDED_W} x ${UNFOLDED_H} pt."
fi
say ""
say "WHAT TO LOOK AT:"
say "  - the bottom row of tabs: labels clear of the home bar, nothing cut off"
say "  - the dice board: the whole arena in frame, not cropped at the sides"
say "  - Inventory and Store: cards in tidy rows at both sizes"
say "  - the fold itself: no flicker, no leftover gap, dice keep rolling"
