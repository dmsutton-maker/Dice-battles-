const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * The game is native-only Expo. The `hq/` folder next to it is a separate
 * Next.js website with its own dependency tree — Metro must not walk into
 * it, or it will try to bundle a web app into the phone game.
 */
const config = getDefaultConfig(__dirname);

const hq = path.resolve(__dirname, 'hq').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${hq}[/\\\\].*`)];

module.exports = config;
