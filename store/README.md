# App Store listing copy

The exact text to paste into App Store Connect, kept here so it is
version-controlled rather than living only in a chat message — and so the
next change to it is a diff rather than a rewrite.

| file | field in App Store Connect | limit |
|---|---|---|
| `subtitle.txt` | Subtitle | 30 |
| `promo.txt` | Promotional Text | 170 |
| `keywords.txt` | Keywords | 100 |
| `description.txt` | Description | 4000 |

Promotional text can be changed WITHOUT submitting a new build, which is
what makes it the right place for anything seasonal or short-lived. The
description and keywords are frozen until the next release, so they carry
the things that stay true.

Keywords deliberately avoid repeating words already in the app's name —
Apple indexes the name separately, so "dice" and "rush" there would be
spent twice.

## Videos

`videos/` holds the App Store videos, rendered from the game itself by
`tools/trailer` (see its README for how to re-render them). Approved by
David on 5 Nov 2026. None of them is uploaded yet.

| file | where it goes in App Store Connect |
|---|---|
| `videos/header-3840x1646.mp4` | the moving header at the top of the product page (21:9, loops, muted) |
| `videos/header-3840x1646.png` | the header's still, for where the video does not play |
| `videos/preview-iphone-886x1920.mp4` | iPhone app preview (portrait) |
| `videos/preview-ipad-1200x1600.mp4` | iPad app preview (portrait) |

Like the screenshots, check the sizes App Store Connect asks for on the
day of the upload rather than trusting this table.
