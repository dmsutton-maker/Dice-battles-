# Looking at the icons

Renders every icon in `src/ui/Icon.tsx` at 96pt and at 22pt, through the
real components, and writes a PNG.

```sh
npm i --no-save --legacy-peer-deps \
  react-dom@19.1.0 react-native-web@0.21.0 playwright@1.49.0
npx esbuild tools/icon-preview/entry.tsx --bundle \
  --outfile=tools/icon-preview/bundle.js --loader:.tsx=tsx \
  --alias:react-native=react-native-web \
  --define:process.env.NODE_ENV='"production"'
node tools/icon-preview/shoot.js /tmp/icons.png
npm uninstall --no-save react-dom react-native-web playwright   # ← REQUIRED
```

`react-native` is aliased to `react-native-web` at bundle time, so the
styles a phone applies are the styles the browser applies — the same
border and transform rules, rather than a hand-drawn guess at them.

## Why this exists

The Ultimate mode icon was got wrong twice, both times on its arrowheads,
and both times signed off against a picture drawn by hand of what the
code was HOPED to produce.

The first version made the loop's gaps by clearing the left and right
border colours of a rounded box — not knowing that each of a rounded
box's four border sides owns one 90-degree quadrant and is mitred at the
diagonals, so clearing the sides leaves the top and bottom quadrants
behind as stubs. The hand-drawn check drew arcs on the left and right,
so it approved a picture the code never made.

The second version fixed that and then drew heads 0.27 of the icon tall
against 0.19 long — wider than they were long — floating clear of a
closed loop. That is a rounded box with two fins on it, which is what
David saw both times.

The third was chosen by rendering four designs side by side and then
sweeping three numbers. That took about ten minutes and no arguing.

## Take the packages back out when you are done

Not tidiness. Expo decides a project supports WEB from `react-dom` and
`react-native-web` being present in node_modules, and this game is
native-only on purpose (AGENTS.md). Leave them installed and `eas update`
starts exporting a web bundle and the publish dies with an error about
the platforms array that has nothing to do with what you changed.
