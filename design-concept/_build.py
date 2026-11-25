"""
Both themes from one drawing.

The screens are written once with token names in the markup, then emitted
twice against the palettes below. Hand-drawing a second set is how a dark
mode drifts: someone nudges a radius in light, forgets the dark file, and
six months later they are two designs. Here they cannot disagree.
"""
import re, pathlib

LIGHT = {
    'ground': '#fdf6ec', 'surface': '#ffffff', 'sunk': '#efe4d4',
    'ink': '#1d1a2e', 'inkSoft': 'rgba(29,26,46,0.6)', 'inkFaint': 'rgba(29,26,46,0.42)',
    'line': '#1d1a2e', 'lineLoud': '#1d1a2e', 'drop': '#1d1a2e',
    'accent': '#d2451e', 'accentInk': '#ffffff', 'gold': '#ffd21f', 'goldInk': '#1d1a2e',
    'tile': '#f5ece0', 'good': '#1c7a48',
}
DARK = {
    'ground': '#15131c', 'surface': '#262231', 'sunk': '#1c1926',
    'ink': '#f6efe4', 'inkSoft': 'rgba(246,239,228,0.55)', 'inkFaint': 'rgba(246,239,228,0.38)',
    'line': '#413b52', 'lineLoud': '#f6efe4', 'drop': '#08070c',
    'accent': '#ff6a3d', 'accentInk': '#1d1a2e', 'gold': '#ffcf2e', 'goldInk': '#1d1a2e',
    'tile': '#302b3d', 'good': '#62dd97',
}

HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap">
  <style>
    body { margin: 0; font-family: Nunito, "Helvetica Neue", system-ui, sans-serif; }
    a { color: $accent; } a:hover { color: $ink; }
    .dsp { font-family: Fredoka, Nunito, system-ui, sans-serif; }
  </style>
</helmet>
'''
TAIL = '''</x-dc>
</body>
</html>
'''

def emit(name, body, pair=None):
    for theme, pal in (pair or (('', LIGHT), ('Dark', DARK))):
        out = HEAD + body + TAIL
        # Longest first, so `inkSoft` is never eaten by `ink`.
        for key in sorted(pal, key=len, reverse=True):
            out = out.replace('$' + key, pal[key])
        leftover = re.findall(r'\$[A-Za-z]+', out)
        assert not leftover, f'{name}{theme}: unresolved {set(leftover)}'
        pathlib.Path(f'{name}{theme}.dc.html').write_text(out)
        print(f'  {name}{theme}.dc.html')

NAV = '''
  <div style="display: flex; background: $surface; border-top: 2px solid $line; padding: 12px 0 30px;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 800;">Store</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="2.1" stroke-linejoin="round"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 800;">Items</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0;">
      <div style="width: 42px; height: 27px; border-radius: 10px; background: $gold; border: 2px solid $lineLoud; display: grid; place-items: center;">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="$goldInk" stroke-width="2.2" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.6" cy="8.6" r="1.5" fill="$goldInk" stroke="none"/><circle cx="15.4" cy="15.4" r="1.5" fill="$goldInk" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="$goldInk" stroke="none"/></svg>
      </div>
      <span style="color: $ink; font-size: 10px; font-weight: 800;">Battle</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M9 20h6"/><path d="M12 14v6"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 800;">Cups</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="2.1" stroke-linecap="round"><path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 800;">Ranks</span>
    </div>
  </div>
'''

PILLS = '''
    <div style="display: flex; gap: 9px;">
      <div style="display: flex; align-items: center; gap: 7px; background: $surface; border: 2px solid $line; border-radius: 14px; padding: 8px 12px; box-shadow: 0 3px 0 $drop;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$accent" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M9 20h6"/><path d="M12 14v6"/></svg>
        <span style="color: $ink; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;">128</span>
      </div>
      <div style="display: flex; align-items: center; gap: 7px; background: $surface; border: 2px solid $line; border-radius: 14px; padding: 8px 12px; box-shadow: 0 3px 0 $drop;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$gold" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
        <span style="color: $ink; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;">420</span>
      </div>
    </div>
'''

HOME = '''
<div style="width: 390px; height: 844px; background: $ground; display: flex; flex-direction: column; overflow: hidden;">

  <div style="display: flex; justify-content: space-between; align-items: center; padding: 58px 20px 0;">
''' + PILLS + '''
    <div style="width: 42px; height: 42px; border-radius: 13px; background: $surface; border: 2px solid $line; box-shadow: 0 3px 0 $drop; display: grid; place-items: center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$ink" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4"/></svg>
    </div>
  </div>

  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 22px;">

    <div class="dsp" style="color: $ink; font-size: 44px; font-weight: 700; letter-spacing: -1px; line-height: 0.98; text-align: center;">Dice Battles</div>
    <div style="background: $accent; color: $accentInk; border: 2px solid $lineLoud; border-radius: 999px; padding: 5px 15px; font-size: 12px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; margin-top: 12px;">Color Rush</div>

    <div style="display: flex; gap: 9px; margin-top: 28px;">
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #cc2533; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #fc8403; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #ffd21f; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #33cc6b; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #3f6bff; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
      <div style="width: 34px; height: 34px; border-radius: 11px; background: #b866f0; border: 2px solid $lineLoud; box-shadow: 0 3px 0 $drop;"></div>
    </div>

    <div style="align-self: stretch; margin-top: 32px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
      <div style="background: $gold; border: 2px solid $lineLoud; border-radius: 18px; padding: 14px; box-shadow: 0 4px 0 $drop;">
        <div class="dsp" style="color: $goldInk; font-size: 17px; font-weight: 700;">Rush</div>
        <div style="color: rgba(29,26,46,0.66); font-size: 11.5px; font-weight: 700; margin-top: 2px;">Free all six</div>
      </div>
      <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 14px; box-shadow: 0 4px 0 $drop;">
        <div class="dsp" style="color: $ink; font-size: 17px; font-weight: 700;">Ultimate</div>
        <div style="color: $inkSoft; font-size: 11.5px; font-weight: 700; margin-top: 2px;">Sends them back</div>
      </div>
      <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 14px; box-shadow: 0 4px 0 $drop;">
        <div class="dsp" style="color: $ink; font-size: 17px; font-weight: 700;">Skirmish</div>
        <div style="color: $inkSoft; font-size: 11.5px; font-weight: 700; margin-top: 2px;">One shared jail</div>
      </div>
      <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 14px; box-shadow: 0 4px 0 $drop;">
        <div class="dsp" style="color: $ink; font-size: 17px; font-weight: 700;">Color War</div>
        <div style="color: $inkSoft; font-size: 11.5px; font-weight: 700; margin-top: 2px;">One colour each</div>
      </div>
    </div>

    <div style="align-self: stretch; display: flex; align-items: center; gap: 10px; margin-top: 18px;">
      <span style="color: $inkSoft; font-size: 12.5px; font-weight: 800;">Rival</span>
      <div style="flex-grow: 1; display: flex; background: $sunk; border-radius: 14px; padding: 3px;">
        <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 13px 0; color: $inkSoft; font-size: 12.5px; font-weight: 800;">Easy</div>
        <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 13px 0; border-radius: 11px; background: $ink; color: $ground; font-size: 12.5px; font-weight: 800;">Medium</div>
        <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 13px 0; color: $inkSoft; font-size: 12.5px; font-weight: 800;">Hard</div>
      </div>
    </div>

    <div style="align-self: stretch; margin-top: 22px; background: $accent; border: 2px solid $lineLoud; border-radius: 20px; padding: 18px; text-align: center; box-shadow: 0 6px 0 $drop;">
      <span class="dsp" style="color: $accentInk; font-size: 21px; font-weight: 700;">Start battle</span>
    </div>
  </div>
''' + NAV + '''
</div>
'''

emit('Home', HOME)

def die(face, extra=''):
    return ('<div style="width: 48px; height: 48px; border-radius: 13px; background: %s; '
            'border: 2px solid $lineLoud; box-shadow: 0 4px 0 $drop; %s"></div>') % (face, extra)

STORE = '''
<div style="width: 390px; height: 844px; background: $ground; display: flex; flex-direction: column; overflow: hidden;">

  <div style="padding: 58px 20px 0; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <div class="dsp" style="color: $ink; font-size: 30px; font-weight: 700; letter-spacing: -0.6px;">Store</div>
      <div style="color: $inkSoft; font-size: 12.5px; font-weight: 700; margin-top: 1px;">Eight sets to collect</div>
    </div>
    <div style="display: flex; align-items: center; gap: 7px; background: $surface; border: 2px solid $line; border-radius: 14px; padding: 8px 12px; box-shadow: 0 3px 0 $drop;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$gold" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
      <span style="color: $ink; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;">420</span>
    </div>
  </div>

  <div style="flex-grow: 1; padding: 22px 20px 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-content: start;">

    <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 13px; box-shadow: 0 4px 0 $drop; display: flex; flex-direction: column; gap: 11px;">
      <div style="height: 80px; border-radius: 12px; background: $tile; display: grid; place-items: center;">
        ''' + die('linear-gradient(140deg, #f6f3ec 0%, #d3cec2 100%)') + '''
      </div>
      <div>
        <div class="dsp" style="color: $ink; font-size: 16px; font-weight: 700;">Marble</div>
        <div style="display: flex; align-items: center; gap: 5px; margin-top: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="$gold" stroke-width="2.6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
          <span style="color: $ink; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums;">500</span>
        </div>
      </div>
    </div>

    <div style="background: $gold; border: 2px solid $lineLoud; border-radius: 18px; padding: 13px; box-shadow: 0 4px 0 $drop; display: flex; flex-direction: column; gap: 11px;">
      <div style="height: 80px; border-radius: 12px; background: rgba(29,26,46,0.12); display: grid; place-items: center;">
        ''' + die('linear-gradient(128deg, #6e5836 0%, #ffe9a8 42%, #d9a63f 62%, #6e5836 100%)') + '''
      </div>
      <div>
        <div class="dsp" style="color: #1d1a2e; font-size: 16px; font-weight: 700;">Gold</div>
        <div style="color: rgba(29,26,46,0.7); font-size: 12px; font-weight: 800; margin-top: 4px;">100 trophies</div>
      </div>
    </div>

    <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 13px; box-shadow: 0 4px 0 $drop; display: flex; flex-direction: column; gap: 11px;">
      <div style="height: 80px; border-radius: 12px; background: $tile; display: grid; place-items: center;">
        ''' + die('linear-gradient(128deg, #8f9aa4 0%, #ffffff 44%, #b9c2ca 62%, #8f9aa4 100%)') + '''
      </div>
      <div>
        <div class="dsp" style="color: $ink; font-size: 16px; font-weight: 700;">Silver</div>
        <div style="display: flex; align-items: center; gap: 5px; margin-top: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="$gold" stroke-width="2.6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
          <span style="color: $ink; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums;">650</span>
        </div>
      </div>
    </div>

    <div style="background: $surface; border: 2px solid $line; border-radius: 18px; padding: 13px; box-shadow: 0 4px 0 $drop; display: flex; flex-direction: column; gap: 11px;">
      <div style="height: 80px; border-radius: 12px; background: $tile; display: grid; place-items: center;">
        ''' + die('#e8f5ff', 'position: relative; overflow: hidden;') + '''
      </div>
      <div>
        <div class="dsp" style="color: $ink; font-size: 16px; font-weight: 700;">Frost</div>
        <div style="display: flex; align-items: center; gap: 5px; margin-top: 4px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="$gold" stroke-width="2.6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
          <span style="color: $ink; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums;">350</span>
        </div>
      </div>
    </div>

  </div>

  <div style="padding: 0 20px 30px;">
    <div style="background: $sunk; border-radius: 15px; padding: 14px 16px; display: flex; align-items: center; gap: 11px;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="$inkSoft" stroke-width="2.2" stroke-linecap="round" style="flex: none;"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <div style="color: $inkSoft; font-size: 12.5px; line-height: 1.4; font-weight: 700;">Tap any set to see it on the real board first.</div>
    </div>
  </div>

</div>
'''

RESULT = '''
<div style="width: 390px; height: 844px; background: $ground; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 24px; overflow: hidden;">

  <div style="width: 84px; height: 84px; border-radius: 26px; background: $gold; border: 3px solid $lineLoud; box-shadow: 0 6px 0 $drop; display: grid; place-items: center;">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="$goldInk" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M9 20h6"/><path d="M12 14v6"/></svg>
  </div>

  <div class="dsp" style="color: $ink; font-size: 40px; font-weight: 700; letter-spacing: -1px; margin-top: 22px;">Victory</div>
  <div style="color: $inkSoft; font-size: 14px; font-weight: 700; margin-top: 2px;">Color Rush · Medium</div>

  <div style="align-self: stretch; display: flex; align-items: center; justify-content: center; gap: 30px; margin-top: 26px; padding: 18px 0; background: $surface; border: 2px solid $line; border-radius: 20px; box-shadow: 0 4px 0 $drop;">
    <div style="text-align: center;">
      <div class="dsp" style="color: $ink; font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums;">6</div>
      <div style="color: $inkSoft; font-size: 11px; font-weight: 800; margin-top: 1px;">You</div>
    </div>
    <div style="width: 2px; height: 34px; background: $line;"></div>
    <div style="text-align: center;">
      <div class="dsp" style="color: $inkSoft; font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums;">4</div>
      <div style="color: $inkSoft; font-size: 11px; font-weight: 800; margin-top: 1px;">Rusty</div>
    </div>
  </div>

  <div style="align-self: stretch; display: flex; gap: 10px; margin-top: 12px;">
    <div style="flex-grow: 1; flex-basis: 0; background: $surface; border: 2px solid $line; border-radius: 17px; padding: 14px; box-shadow: 0 4px 0 $drop;">
      <div style="color: $inkSoft; font-size: 11.5px; font-weight: 800;">Trophies</div>
      <div class="dsp" style="color: $ink; font-size: 23px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums;">128 <span style="color: $good; font-size: 15px;">+18</span></div>
    </div>
    <div style="flex-grow: 1; flex-basis: 0; background: $surface; border: 2px solid $line; border-radius: 17px; padding: 14px; box-shadow: 0 4px 0 $drop;">
      <div style="color: $inkSoft; font-size: 11.5px; font-weight: 800;">Coins</div>
      <div class="dsp" style="color: $ink; font-size: 23px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums;">420 <span style="color: $good; font-size: 15px;">+35</span></div>
    </div>
  </div>

  <div style="align-self: stretch; margin-top: 12px; background: $surface; border: 2px solid $line; border-radius: 17px; padding: 15px 16px; box-shadow: 0 4px 0 $drop;">
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <span style="color: $inkSoft; font-size: 11.5px; font-weight: 800;">Next · Jungle Clearing</span>
      <span style="color: $ink; font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums;">128 / 290</span>
    </div>
    <div style="height: 10px; border-radius: 5px; background: $sunk; border: 2px solid $line; margin-top: 9px; overflow: hidden;">
      <div style="width: 44%; height: 6px; background: $gold;"></div>
    </div>
  </div>

  <div style="align-self: stretch; margin-top: 24px; background: $accent; border: 2px solid $lineLoud; border-radius: 20px; padding: 18px; text-align: center; box-shadow: 0 6px 0 $drop;">
    <span class="dsp" style="color: $accentInk; font-size: 21px; font-weight: 700;">Play again</span>
  </div>
  <div style="align-self: stretch; margin-top: 10px; background: $surface; border: 2px solid $line; border-radius: 20px; padding: 16px; text-align: center; box-shadow: 0 4px 0 $drop;">
    <span style="color: $ink; font-size: 16px; font-weight: 800;">Home</span>
  </div>

</div>
'''

emit('Store', STORE)
emit('Result', RESULT)


# ---------------------------------------------------------------------
# Direction A — "Deep Table". Its character is glow and glass, which is
# native to dark and has to be TRANSLATED for light rather than inverted:
# a soft cast shadow does in daylight what a glow does at night.
# ---------------------------------------------------------------------

A_DARK = {
    'ground': 'radial-gradient(120% 62% at 50% 8%, #3b2a63 0%, #241a44 42%, #150f2c 100%)',
    'halo': 'radial-gradient(circle, rgba(255,216,77,0.16) 0%, rgba(255,216,77,0) 68%)',
    'panel': 'rgba(255,255,255,0.05)', 'panelLine': 'rgba(255,255,255,0.09)',
    'chip': 'rgba(255,255,255,0.07)', 'chipLine': 'rgba(255,255,255,0.11)',
    'sel': 'rgba(255,255,255,0.11)',
    'ink': '#ffffff', 'inkSoft': 'rgba(255,255,255,0.66)', 'inkFaint': 'rgba(255,255,255,0.49)',
    'gold': 'linear-gradient(180deg, #ffe268 0%, #ffc93a 100%)', 'goldFlat': '#ffd84d',
    'goldInk': '#241a44', 'lift': '0 10px 28px rgba(255,201,58,0.28)',
    'navFace': 'rgba(16,11,32,0.72)', 'navLine': 'rgba(255,255,255,0.07)',
    'navPill': 'rgba(255,216,77,0.15)',
    'accent': '#ffd84d',
}
A_LIGHT = {
    'ground': 'radial-gradient(120% 62% at 50% 8%, #fffaf0 0%, #f6f1e6 44%, #ece5d8 100%)',
    'halo': 'radial-gradient(circle, rgba(216,158,26,0.13) 0%, rgba(216,158,26,0) 68%)',
    'panel': '#ffffff', 'panelLine': 'rgba(36,26,68,0.09)',
    'chip': '#ffffff', 'chipLine': 'rgba(36,26,68,0.1)',
    'sel': '#f0ebe0',
    'ink': '#241a44', 'inkSoft': 'rgba(36,26,68,0.68)', 'inkFaint': 'rgba(36,26,68,0.62)',
    'gold': 'linear-gradient(180deg, #ffd githubPLACEHOLDER 0%, #e8ae1c 100%)', 'goldFlat': '#f0bd2a',
    'goldInk': '#241a44', 'lift': '0 8px 22px rgba(36,26,68,0.14)',
    'navFace': '#ffffff', 'navLine': 'rgba(36,26,68,0.08)',
    'navPill': 'rgba(232,174,28,0.16)',
    'accent': '#8a6308',
}
A_LIGHT['gold'] = 'linear-gradient(180deg, #ffdd6e 0%, #e8ae1c 100%)'

HOME_A = '''
<div style="width: 390px; height: 844px; background: $ground; display: flex; flex-direction: column; overflow: hidden; position: relative;">

  <div style="position: absolute; top: 96px; left: 50%; transform: translateX(-50%); width: 300px; height: 300px; border-radius: 150px; background: $halo;"></div>

  <div style="display: flex; justify-content: space-between; align-items: center; padding: 58px 20px 0; position: relative;">
    <div style="display: flex; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 7px; background: $chip; border: 1px solid $chipLine; border-radius: 12px; padding: 8px 12px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$goldFlat" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M9 20h6"/><path d="M12 14v6"/></svg>
        <span style="color: $ink; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;">128</span>
      </div>
      <div style="display: flex; align-items: center; gap: 7px; background: $chip; border: 1px solid $chipLine; border-radius: 12px; padding: 8px 12px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$goldFlat" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>
        <span style="color: $ink; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;">420</span>
      </div>
    </div>
    <div style="width: 44px; height: 44px; border-radius: 13px; background: $chip; border: 1px solid $chipLine; display: grid; place-items: center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$inkSoft" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1M18.6 18.6l-2.1-2.1M7.5 7.5 5.4 5.4"/></svg>
    </div>
  </div>

  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 22px; position: relative;">

    <div style="display: flex; gap: 7px; margin-bottom: 22px;">
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #cc2533;"></div>
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #fc8403;"></div>
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #ffd21f;"></div>
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #33cc6b;"></div>
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #3f6bff;"></div>
      <div style="width: 15px; height: 15px; border-radius: 5px; background: #b866f0;"></div>
    </div>

    <div class="dsp" style="color: $ink; font-size: 46px; font-weight: 900; letter-spacing: -1.6px; line-height: 0.94; text-align: center;">Dice<br>Battles</div>
    <div style="color: $inkFaint; font-size: 12px; font-weight: 700; letter-spacing: 3.4px; text-transform: uppercase; margin-top: 10px;">Color Rush</div>

    <div style="align-self: stretch; margin-top: 38px; background: $panel; border: 1px solid $panelLine; border-radius: 20px; padding: 6px; display: flex; gap: 4px;">
      <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 14px 0; border-radius: 15px; background: $sel; color: $ink; font-size: 13.5px; font-weight: 700;">Rush</div>
      <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 14px 0; border-radius: 15px; color: $inkFaint; font-size: 13.5px; font-weight: 600;">Ultimate</div>
      <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 14px 0; border-radius: 15px; color: $inkFaint; font-size: 13.5px; font-weight: 600;">Skirmish</div>
      <div style="flex-grow: 1; flex-basis: 0; text-align: center; padding: 14px 0; border-radius: 15px; color: $inkFaint; font-size: 13.5px; font-weight: 600;">War</div>
    </div>

    <div style="align-self: stretch; display: flex; align-items: center; justify-content: space-between; margin-top: 14px;">
      <div style="color: $inkFaint; font-size: 12.5px; font-weight: 600;">Opponent</div>
      <div style="display: flex; gap: 6px;">
        <div style="padding: 13px 15px; border-radius: 12px; color: $inkFaint; font-size: 12.5px; font-weight: 600;">Easy</div>
        <div style="padding: 13px 15px; border-radius: 12px; background: $goldFlat; color: $goldInk; font-size: 12.5px; font-weight: 800;">Medium</div>
        <div style="padding: 13px 15px; border-radius: 12px; color: $inkFaint; font-size: 12.5px; font-weight: 600;">Hard</div>
      </div>
    </div>

    <div style="align-self: stretch; display: flex; align-items: flex-start; gap: 9px; margin-top: 14px; padding: 13px 15px; background: $panel; border: 1px solid $panelLine; border-radius: 15px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="$goldFlat" stroke-width="2" stroke-linecap="round" style="flex: none; margin-top: 1px;"><path d="M4 18l6-9 4 5 2-3 4 7z"/></svg>
      <div style="color: $inkSoft; font-size: 12.5px; line-height: 1.45; font-weight: 500;">A hill in a new spot every battle — the dice bounce off it.</div>
    </div>

    <div style="align-self: stretch; margin-top: 24px; background: $gold; border-radius: 19px; padding: 18px; text-align: center; box-shadow: $lift;">
      <span class="dsp" style="color: $goldInk; font-size: 19px; font-weight: 700; letter-spacing: -0.2px;">Start battle</span>
    </div>
  </div>

  <div style="display: flex; background: $navFace; border-top: 1px solid $navLine; padding: 12px 0 30px;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 5px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 600;">Store</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 5px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="M4 8.5 12 13l8-4.5M12 13v7"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 600;">Items</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 5px 0;">
      <div style="width: 40px; height: 26px; border-radius: 9px; background: $navPill; display: grid; place-items: center;">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$goldFlat" stroke-width="1.9" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.6" cy="8.6" r="1.5" fill="$goldFlat" stroke="none"/><circle cx="15.4" cy="15.4" r="1.5" fill="$goldFlat" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="$goldFlat" stroke="none"/></svg>
      </div>
      <span style="color: $ink; font-size: 10px; font-weight: 700;">Battle</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 5px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/><path d="M9 20h6"/><path d="M12 14v6"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 600;">Cups</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 5px 0;">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="$inkFaint" stroke-width="1.8" stroke-linecap="round"><path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/></svg>
      <span style="color: $inkFaint; font-size: 10px; font-weight: 600;">Ranks</span>
    </div>
  </div>

</div>
'''

# Direction A uses Gabarito + Manrope, not Fredoka + Nunito.
_A_HEAD = HEAD.replace(
    'family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800',
    'family=Gabarito:wght@500;600;700;900&family=Manrope:wght@500;600;700;800',
).replace('font-family: Nunito,', 'font-family: Manrope,').replace(
    'font-family: Fredoka, Nunito,', 'font-family: Gabarito, Manrope,')

_orig_head = HEAD
HEAD = _A_HEAD
emit('HomeA', HOME_A, pair=(('Light', A_LIGHT), ('Dark', A_DARK)))
HEAD = _orig_head

import os
if os.path.exists('Home.dc.html'):
    os.replace('Home.dc.html', 'Main.dc.html')
    print('  Home.dc.html -> Main.dc.html (entry artboard)')
