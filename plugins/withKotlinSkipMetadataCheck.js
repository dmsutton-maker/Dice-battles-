/**
 * Android build only: let Kotlin 2.1 compile against Google's ads SDK.
 *
 * 16 Nov 2026, the first Google Play build. react-native-google-mobile-ads
 * 16.5 brings play-services-ads 25.4, whose jar was built with Kotlin 2.3.
 * Expo SDK 54 / React Native 0.81 compile with Kotlin 2.1.20, which only
 * reads metadata one version ahead, so the ad module failed with "Module was
 * compiled with an incompatible version of Kotlin ... 2.3.0, expected 2.1.0".
 * Raising Kotlin through expo-build-properties did not reach the compiler
 * (its version comes from React Native's own catalogue).
 *
 * `-Xskip-metadata-version-check` is the compiler's own switch for exactly
 * this: the ad module only calls the SDK's Java API, which is unchanged.
 * Nothing here touches iOS or the JavaScript.
 */
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARK = '// dice-battles: Kotlin reads newer library metadata (plugins/withKotlinSkipMetadataCheck.js)';

const BLOCK = `
${MARK}
allprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    compilerOptions.freeCompilerArgs.add("-Xskip-metadata-version-check")
  }
}
`;

module.exports = function withKotlinSkipMetadataCheck(config) {
  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy' && !c.modResults.contents.includes(MARK)) {
      c.modResults.contents += BLOCK;
    }
    return c;
  });
};
