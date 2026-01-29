import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.dbe7c09e890d426fa16e87be73f132f4',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://dbe7c09e-890d-426f-a16e-87be73f132f4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    App: {
      // App lifecycle handling for background mode
    }
  }
};

export default config;
