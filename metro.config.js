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

module.exports = config;
