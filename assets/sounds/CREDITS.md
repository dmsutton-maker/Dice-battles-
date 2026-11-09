# Sound credits

The record of where every sound came from. **Nothing in the game requires
attribution**: the music, the fanfares, the title-card sting, the purchase
sound, the rescue cheer and the UI sounds are the game's own — composed and
synthesised for it, with no samples and no third-party sound in them (see
`tools/music`) — and the dice and the announcer are Kenney's CC0 recordings
from OpenGameArt.org, processed (trimmed, mono, normalized) for the game.

Marc, 5 Nov 2026: "take away the music that we had before and take away
the credits for it so we don't have to give credits to anyone and all the
music in the game is just ours." The Creative Commons music and crowd
cheer that were here before that, which needed their authors named in the
app, are gone, and so is the credits section in Settings.

| Files | Source | Author | License |
| --- | --- | --- | --- |
| `music-pixel.m4a`, `music-pixel-hot.m4a`, `music-brass.m4a`, `music-brass-hot.m4a`, `music-neon.m4a`, `music-neon-hot.m4a`, `music-lobby.m4a`, `fanfare-pixel.m4a`, `fanfare-brass.m4a`, `fanfare-neon.m4a`, `startup.m4a`, `purchase.m4a`, `cheer.m4a` | Composed and synthesised for this game by Paper Ship Studio, `tools/music` — no samples | Paper Ship Studio | Own work, no attribution needed |
| `click.wav` | Synthesised for this project (a 55ms tick) — no external source | Paper Ship Studio | Own work, no attribution needed |
| `equip.wav` | A two-note bloop, synthesised for this project (`tools/music/equip.py`: two rounded bubble pops sliding up to D5 and A5) — no external source | Paper Ship Studio | Own work, no attribution needed |
| `throw1-3.wav`, `clack1-3.wav` | [Casino sound effects](https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips) — real dice recordings | [Kenney](https://kenney.nl) | CC0 (public domain) |
| `../voice/*.m4a` | [Voiceover Pack (40+ lines)](https://opengameart.org/content/voiceover-pack-40-lines) — announcer voice | [Kenney](https://kenney.nl) | CC0 (public domain) |

Nothing in the game requires attribution. CC0 needs no credit (crediting
Kenney somewhere is a nice courtesy, not a condition). If a sound that DOES
need its author named is ever added, mark its row with the wording
`tests/audio.test.ts` looks for (see the comment there) — that test then
fails until the name is on the Settings screen.
