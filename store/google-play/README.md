# Google Play listing

Made 16 Nov 2026 for the first Google Play release (David: "lets get the
android app going").

| Play Console field | File | Limit |
|---|---|---|
| App name | `Dice Battles: Color Rush` (same as the App Store) | 30 characters |
| Short description | `short-description.txt` | 80 characters |
| Full description | `../description.txt` (the App Store text; it names no Apple feature) | 4,000 characters |
| App icon | `icon-512.png` (512 × 512, from `assets/icon/light.png`) | 512 × 512 PNG |
| Feature graphic | `feature-1024x500.png` (from the App Store header art) | 1024 × 500, no transparency |
| Phone screenshots | `phone/01–06.png`, 1080 × 1920 | 2–8, 9:16, each side 320–3,840 px |
| Tablet screenshots (7" and 10") | `../screenshots/ipad/01–06.png`, 2048 × 2732 | each side 320–3,840 px, no side more than twice the other |

The iPhone screenshots are 1290 × 2796, which Play refuses because the
long side is more than twice the short one. The phone set is the same six
pictures fitted to 9:16 over a blurred, dimmed copy of themselves, so
nothing is cropped. Rebuild them from the iPhone set if those change.

**Real screens only, since 23 Nov 2026.** Apple rejected 1.60.0 under
Guideline 2.3.3 because the first screenshots were marketing art and did
not show the app in use. Google's metadata policy asks the same of a
Families app, so both stores now use pictures taken on David's iPhone
during real games: no added captions, frames or art. Keep it that way:
the store pictures are screens from the game, fitted to size and nothing
more. The tablet sets still use the old iPad art until real iPad
screenshots replace them.
