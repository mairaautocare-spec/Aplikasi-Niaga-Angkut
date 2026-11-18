import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.niagaangkut.app',
  appName: 'NiagaAngkut',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
