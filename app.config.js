const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

module.exports = ({ config }) => {
  const release = ['production', 'preview'].includes(process.env.EAS_BUILD_PROFILE) ||
    process.env.EXPO_PUBLIC_ENV?.trim().toUpperCase() === 'PRODUCTION';
  if (!release) return config;
  if (process.env.EXPO_PUBLIC_ENV?.trim().toUpperCase() === 'LOCAL') {
    throw new Error('Release builds cannot use EXPO_PUBLIC_ENV=LOCAL');
  }
  const url = new URL(process.env.EXPO_PUBLIC_PRODUCTION_URL || 'https://backend.h7tex.com');
  if (url.protocol !== 'https:' || url.username || url.password ||
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname)) {
    throw new Error('Release API must use a public HTTPS URL without credentials');
  }
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSAppTransportSecurity = { NSAllowsArbitraryLoads: false };
    return mod;
  });
  return withAndroidManifest(config, (mod) => {
    for (const application of mod.modResults.manifest.application || []) {
      application.$['android:usesCleartextTraffic'] = 'false';
    }
    return mod;
  });
};
