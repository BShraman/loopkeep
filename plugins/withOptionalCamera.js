const { withAndroidManifest } = require('expo/config-plugins');

// Asking for the CAMERA permission makes Google Play treat a camera as
// required hardware, which hides the app from devices without one (many
// tablets and Chromebooks). Barcode scanning is optional in Loopkeep, so mark
// the camera features as not required.
const OPTIONAL_FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus'];

module.exports = function withOptionalCamera(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] ?? []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((f) => f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
