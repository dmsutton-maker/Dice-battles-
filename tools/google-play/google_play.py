"""
Google Play for Dice Battles: Color Rush, from GitHub Actions.

David, 17 Nov 2026: "you have already done all this for the other lease dash
app". LeaseDash keeps its Play key as a GitHub secret and runs a script like
this one on GitHub, so Dice Battles does the same. The key lives ONLY in the
repository secret PLAY_SERVICE_ACCOUNT_JSON (this repo is public: never in a
file, a log or a commit). It belongs to
claude-play-publisher@paper-ship-studio-play.iam.gserviceaccount.com.

Run by .github/workflows/google-play.yml. Actions:

  check     the listing files are all there and the right sizes; asks Google
            nothing, needs no key.
  preview   opens an edit, uploads everything, then THROWS THE EDIT AWAY.
            Nothing is saved; it proves the key and the pictures work.
  listing   the same, and saves it (title, descriptions, contact, icon,
            feature graphic, phone and tablet screenshots).
  products  creates or updates the in-app purchases (PRODUCTS below) with
            Google's one-time products API, active, US price with Google
            converting the rest.
  release   puts --version-code on --track (internal / production) with the
            release notes, and saves. A production release goes to Google's
            review; with managed publishing off it goes live when approved.

Google keeps some things to its website, so this never touches them: content
rating, target audience, Data safety, the other App content declarations,
countries, and the very first upload of a build.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import struct
import sys
from pathlib import Path

PACKAGE = "com.dmsutton.dicebattles"
ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "store"
PLAY = STORE / "google-play"
LANG = "en-US"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}"
UPLOAD = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}"

TITLE = "Dice Battles: Color Rush"
CONTACT_EMAIL = "david@papershipstudio.com"
CONTACT_WEBSITE = "https://papershipstudio.com"

# The same ids and US prices as the App Store (src/game/products.ts).
# dino_valley is hidden from the Shop and is not sold on Google Play.
PRODUCTS = [
    ("remove_ads", "No more ads", "No more ads, ever.", "3.99"),
    ("coins_pouch", "Pouch of coins", "500 coins to spend in the Shop.", "0.99"),
    ("coins_chest", "Chest of coins", "3,000 coins to spend in the Shop.", "4.99"),
    ("coins_vault", "Vault of coins", "7,000 coins to spend in the Shop.", "9.99"),
    ("starter_pack", "Starter pack", "1,500 coins and the Supporter dice.", "4.99"),
    ("neon_dice", "Neon dice", "Glowing dice with a light trail.", "0.99"),
    ("gold_pass", "Gold Pass", "This season's Gold row of prizes on the season track.", "2.99"),
]


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} is not a PNG")
    return struct.unpack(">II", head[16:24])


def images() -> dict[str, list[Path]]:
    return {
        "icon": [PLAY / "icon-512.png"],
        "featureGraphic": [PLAY / "feature-1024x500.png"],
        "phoneScreenshots": sorted((PLAY / "phone").glob("0*.png")),
        "sevenInchScreenshots": sorted((STORE / "screenshots" / "ipad").glob("0*.png")),
        "tenInchScreenshots": sorted((STORE / "screenshots" / "ipad").glob("0*.png")),
    }


def texts() -> dict[str, str]:
    return {
        "title": TITLE,
        "shortDescription": (PLAY / "short-description.txt").read_text(encoding="utf-8").strip(),
        "fullDescription": (STORE / "description.txt").read_text(encoding="utf-8").strip(),
    }


def check() -> None:
    t = texts()
    problems = []
    if len(t["title"]) > 30:
        problems.append("title over 30 characters")
    if len(t["shortDescription"]) > 80:
        problems.append("short description over 80 characters")
    if len(t["fullDescription"]) > 4000:
        problems.append("full description over 4,000 characters")
    for kind, paths in images().items():
        if not paths:
            problems.append(f"{kind}: no pictures")
        for p in paths:
            w, h = png_size(p)
            if kind == "icon" and (w, h) != (512, 512):
                problems.append(f"{p.name}: icon must be 512x512")
            elif kind == "featureGraphic" and (w, h) != (1024, 500):
                problems.append(f"{p.name}: feature graphic must be 1024x500")
            elif kind.endswith("Screenshots") and (min(w, h) < 320 or max(w, h) > 3840 or max(w, h) > 2 * min(w, h)):
                problems.append(f"{p.name}: {w}x{h} is not a size Play accepts")
        print(f"{kind}: {len(paths)} picture(s)")
    print(f"title: {len(t['title'])} chars, short: {len(t['shortDescription'])}, full: {len(t['fullDescription'])}")
    if problems:
        raise SystemExit("PROBLEMS:\n  " + "\n  ".join(problems))
    print("Listing files are complete.")


def session():
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account

    raw = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise SystemExit("PLAY_SERVICE_ACCOUNT_JSON is not set (the GitHub secret is missing).")
    creds = service_account.Credentials.from_service_account_info(
        json.loads(raw), scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    return AuthorizedSession(creds)


def ok(r, what: str):
    if r.status_code >= 300:
        # Google's own error text, never the request (which carries no key anyway).
        raise SystemExit(f"{what} failed: HTTP {r.status_code}: {r.text[:1500]}")
    return r.json() if r.content else {}


def commit(s, edit: str) -> None:
    """Save an edit.

    17 Nov 2026: with Managed publishing OFF, Google sends every saved change
    for review at once, and for this not-yet-live app it refused that with
    403 PERMISSION_DENIED (builds to Internal testing, which need no review,
    saved fine). With Managed publishing ON, changes wait in Publishing
    overview for David to send, and Google wants changesNotSentForReview.
    So: ask for "not sent" first, and if Google says changes are sent
    automatically here, save the ordinary way.
    """
    r = s.post(f"{API}/edits/{edit}:commit?changesNotSentForReview=true")
    if r.status_code == 400 and "sent for review automatically" in r.text:
        r = s.post(f"{API}/edits/{edit}:commit")
    if r.status_code == 403:
        raise SystemExit(
            "save refused (403). If Managed publishing is OFF in Play Console "
            "(Publishing overview), Google will not let this app's changes be "
            "sent for review from here: turn Managed publishing ON and run again. "
            f"Google said: {r.text[:600]}"
        )
    ok(r, "save")


def push_listing(s, save: bool) -> None:
    edit = ok(s.post(f"{API}/edits"), "open edit")["id"]
    try:
        t = texts()
        ok(s.put(f"{API}/edits/{edit}/listings/{LANG}", json={"language": LANG, **t}), "listing text")
        print("listing text: set")
        ok(
            s.patch(
                f"{API}/edits/{edit}/details",
                json={"defaultLanguage": LANG, "contactEmail": CONTACT_EMAIL, "contactWebsite": CONTACT_WEBSITE},
            ),
            "contact details",
        )
        print(f"contact: {CONTACT_EMAIL}, {CONTACT_WEBSITE}")
        for kind, paths in images().items():
            ok(s.delete(f"{API}/edits/{edit}/listings/{LANG}/{kind}"), f"clear {kind}")
            for p in paths:
                ok(
                    s.post(
                        f"{UPLOAD}/edits/{edit}/listings/{LANG}/{kind}?uploadType=media",
                        data=p.read_bytes(),
                        headers={"Content-Type": "image/png"},
                    ),
                    f"upload {kind} {p.name}",
                )
            print(f"{kind}: {len(paths)} picture(s) uploaded")
        # No separate :validate call: on 17 Nov 2026 Google answered it with
        # 403 PERMISSION_DENIED for this account while every upload in the
        # same edit succeeded. Saving validates anyway, and a failed save
        # changes nothing.
        if save:
            commit(s, edit)
            print("SAVED.")
            edit = None
        else:
            print("Preview only: the edit is thrown away; nothing was saved.")
    finally:
        if edit:
            s.delete(f"{API}/edits/{edit}")


def money(usd: str) -> dict:
    units, _, cents = usd.partition(".")
    return {"currencyCode": "USD", "units": units, "nanos": int((cents + "00")[:2]) * 10_000_000}


# Newest first. Google's region list changes (Bulgaria moved from BGN to EUR
# on 1 Jan 2026, and "2022/02" still expects BGN), and the price conversion
# answers in today's currencies, so the newest version Google accepts wins.
REGIONS_VERSIONS = ["2026/01", "2025/03", "2025/01", "2022/02"]


def save_product(s, sku: str, body: dict) -> None:
    """PATCH the product, trying regions versions newest first. If none fits
    every country, the countries whose currency the version disagrees with
    are left out (named in the log) rather than given a wrong price."""
    last = None
    for version in REGIONS_VERSIONS:
        r = s.patch(
            f"{API}/onetimeproducts/{sku}",
            params={"updateMask": "listings,purchaseOptions", "allowMissing": "true", "regionsVersion.version": version},
            json=body,
        )
        if r.status_code < 300:
            print(f"{sku}: saved with regions version {version}")
            return
        last = r
        if r.status_code == 400 and ("regions version" in r.text.lower() or "regionsversion" in r.text.lower() or "invalid currency" in r.text.lower()):
            continue
        ok(r, f"save {sku}")
    # Every version disagreed about some currency: drop those countries.
    version = REGIONS_VERSIONS[-1]
    option = body["purchaseOptions"][0]
    dropped = []
    for _ in range(20):
        r = s.patch(
            f"{API}/onetimeproducts/{sku}",
            params={"updateMask": "listings,purchaseOptions", "allowMissing": "true", "regionsVersion.version": version},
            json=body,
        )
        if r.status_code < 300:
            print(f"{sku}: saved with regions version {version}; left out (currency changed): {', '.join(dropped) or 'none'}")
            return
        m = re.search(r"region code ([A-Z]{2})", r.text)
        if r.status_code != 400 or not m:
            ok(r, f"save {sku}")
        code = m.group(1)
        dropped.append(code)
        option["regionalPricingAndAvailabilityConfigs"] = [
            c for c in option["regionalPricingAndAvailabilityConfigs"] if c["regionCode"] != code
        ]
    ok(last, f"save {sku}")


def push_products(s) -> None:
    """Create or update the one-time products with Google's current API.

    17 Nov 2026: the old inappproducts API answered "Please migrate to the
    new publishing API", so this uses monetization.onetimeproducts. Each
    product gets one purchase option, "buy", legacy-compatible so the
    billing library in the game sees it as an ordinary product; its price
    in every country is Google's own conversion of the US price, the same
    as "let Google set other countries" in Play Console.
    """
    for sku, title, description, usd in PRODUCTS:
        converted = ok(
            s.post(f"{API}/pricing:convertRegionPrices", json={"price": money(usd)}),
            f"convert {sku} prices",
        )
        regional = [
            {"regionCode": code, "price": entry["price"], "availability": "AVAILABLE"}
            for code, entry in sorted((converted.get("convertedRegionPrices") or {}).items())
        ]
        other = converted.get("convertedOtherRegionsPrice") or {}
        option = {
            "purchaseOptionId": "buy",
            "buyOption": {"legacyCompatible": True, "multiQuantityEnabled": False},
            "regionalPricingAndAvailabilityConfigs": regional,
        }
        if other.get("usdPrice") and other.get("eurPrice"):
            option["newRegionsConfig"] = {
                "usdPrice": other["usdPrice"],
                "eurPrice": other["eurPrice"],
                "availability": "AVAILABLE",
            }
        body = {
            "packageName": PACKAGE,
            "productId": sku,
            "listings": [{"languageCode": LANG, "title": title, "description": description}],
            "purchaseOptions": [option],
        }
        save_product(s, sku, body)
        ok(
            s.post(
                f"{API}/onetimeproducts/{sku}/purchaseOptions:batchUpdateStates",
                json={
                    "requests": [
                        {
                            "activatePurchaseOptionRequest": {
                                "packageName": PACKAGE,
                                "productId": sku,
                                "purchaseOptionId": "buy",
                            }
                        }
                    ]
                },
            ),
            f"activate {sku}",
        )
        print(f"{sku}: saved and active, ${usd} in the US, {len(regional)} countries priced")


def push_release(s, track: str, version_code: int, notes: str) -> None:
    if track not in ("internal", "alpha", "beta", "production"):
        raise SystemExit(f"unknown track {track}")
    edit = ok(s.post(f"{API}/edits"), "open edit")["id"]
    try:
        body = {
            "track": track,
            "releases": [
                {
                    "versionCodes": [str(version_code)],
                    "status": "completed",
                    "releaseNotes": [{"language": LANG, "text": notes}],
                }
            ],
        }
        ok(s.put(f"{API}/edits/{edit}/tracks/{track}", json=body), f"set {track}")
        commit(s, edit)
        print(f"SAVED: build {version_code} on {track}.")
        edit = None
    finally:
        if edit:
            s.delete(f"{API}/edits/{edit}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["check", "preview", "listing", "products", "release"])
    ap.add_argument("--track", default="internal")
    ap.add_argument("--version-code", type=int, default=0)
    ap.add_argument("--notes", default="")
    a = ap.parse_args()
    check()
    if a.action == "check":
        return
    s = session()
    if a.action in ("preview", "listing"):
        push_listing(s, save=a.action == "listing")
    elif a.action == "products":
        push_products(s)
    elif a.action == "release":
        if not a.version_code or not a.notes.strip():
            raise SystemExit("release needs --version-code and --notes")
        push_release(s, a.track, a.version_code, a.notes.strip())


if __name__ == "__main__":
    sys.exit(main())
