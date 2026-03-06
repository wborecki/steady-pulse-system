import { createRoot } from "react-dom/client";
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import App from "./App.tsx";
import "./index.css";

// Inicializa plugins nativos do Capacitor quando rodando como app
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0a0a0a' }).catch(() => {});

  if (Capacitor.getPlatform() === 'ios') {
    // iOS: overlay + safe-area CSS para compensar notch/dynamic island
    document.documentElement.classList.add('native-app');
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  } else {
    // Android: não fazer overlay — o sistema já posiciona a WebView abaixo
    // da barra de status, evitando corte no topo
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  }

  SplashScreen.hide().catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
