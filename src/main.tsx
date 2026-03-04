import { createRoot } from "react-dom/client";
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import App from "./App.tsx";
import "./index.css";

// Inicializa plugins nativos do Capacitor quando rodando como app
if (Capacitor.isNativePlatform()) {
  // Marca o HTML para CSS saber que estamos em app nativo
  document.documentElement.classList.add('native-app');

  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0a0a0a' }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
