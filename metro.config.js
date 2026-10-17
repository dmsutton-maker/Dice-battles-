const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * The game is native-only Expo. Two folders next to it must be kept out
 * of the phone bundle entirely:
 *
 *  - `hq/` is a separate Next.js website with its own dependency tree.
 *  - `tools/` holds development harnesses that import browser-only
 *    packages (react-dom, playwright) to render the arenas for a human
 *    to look at. Nothing in there may reach a device.
 */
const config = getDefaultConfig(__dirname);

const escape = (p) => path.resolve(__dirname, p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = ['hq', 'tools'].map(
  (dir) => new RegExp(`^${escape(dir)}[/\\\\].*`),
);

/*
  ONE copy of three.js, not two.

  three's package.json sends `import` to its ES build and `require` to
  its CommonJS build. The game imports it (`import * as THREE`), while
  @react-three/fiber/native requires it, so the phone was shipping both:
  about 900 KB of duplicate JavaScript (a fifth of the bundle), two
  "Multiple instances of Three.js" warnings, and R3F's `instanceof
  THREE.Color` checks running against a different copy from the objects
  the game hands it. Every `three` import now resolves to the CommonJS
  build, the one R3F already uses. Deep imports such as
  `three/examples/jsm/...` import plain `three` inside, so they follow.
*/
const ONE_THREE = path.resolve(__dirname, 'node_modules/three/build/three.cjs');
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: ONE_THREE };
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
