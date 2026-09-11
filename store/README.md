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
