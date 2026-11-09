import type { CapacitorConfig } from '@capacitor/cli';

// The SCU app is a TanStack Start SSR app — there is no static web bundle to
// bundle into the APK (server functions like AI chat/lore ingest need the
// backend). The Android shell therefore loads the published Lovable app in a
// native WebView. Replace APP_URL with your live published URL if it differs.
const APP_URL = 'https://sentinels-cinematic-universe.lovable.app';

const config: CapacitorConfig = {
  appId: 'com.sentinelscineticuniverse',
  appName: 'Sentinels Cinematic Universe',
  webDir: 'dist',
  server: {
    url: APP_URL,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
