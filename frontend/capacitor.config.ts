import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psecurit.shotspot',
  appName: 'ShotSpot',
  webDir: 'dist',
  server: {
    // Allow the app to make requests to the backend
    // In production, this should be set to your actual backend URL
    // For development, use localhost or your dev server IP
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1a73e8",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
