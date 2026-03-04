import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solutionsinbi.monitorhub',
  appName: 'Monitor Hub',
  webDir: 'dist',
  server: {
    // Para dev local, descomente a linha abaixo com o IP da sua máquina:
    // url: 'http://192.168.1.100:8080',
    androidScheme: 'https',
    // Permite mixed content ao usar URL de dev local
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
  },
  android: {
    // Ajusta pra telas com notch/punch-hole
    allowMixedContent: true,
  },
};

export default config;
