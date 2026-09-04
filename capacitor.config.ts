import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amaratvkrishi.salescrm',
  appName: 'Amaratv Krishi Sales CRM',
  webDir: 'dist',
  server: {
    // Production remains HTTPS. The local Android harness opts into HTTP only
    // when it builds against the disposable loopback Supabase stack.
    androidScheme: process.env.CAPACITOR_ANDROID_SCHEME === 'http' ? 'http' : 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#16a34a',
    },
  },
};

export default config;
