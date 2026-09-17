"use client";

import { useState, useEffect } from "react";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const DISMISSED_KEY = "conto_install_dismissed";
const INSTALLED_KEY = "conto_install_shown";

interface InstallPromptProps {
  show: boolean;
  onDismiss: () => void;
}

export default function InstallPrompt({ show, onDismiss }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIsIOSDevice(isIOS());
  }, []);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      localStorage.setItem(INSTALLED_KEY, "true");
    }
    setDeferredPrompt(null);
    onDismiss();
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    onDismiss();
  };

  if (!show || installed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-[#1a1a1a] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header with gradient */}
        <div className="relative h-40 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,183,107,0.15),transparent_70%)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt="Conto"
            className="w-24 h-24 rounded-2xl shadow-lg relative z-10"
          />
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-3">
          <h2 className="text-xl font-bold text-white">¿Te gusta Conto?</h2>
          <p className="text-sm text-muted leading-relaxed">
            {deferredPrompt
              ? "Instalalo en tu celular para acceder más rápido y pedir al toque."
              : "Agregalo a tu pantalla de inicio para acceder más rápido y pedir al toque."}
          </p>

          <p className="text-xs text-white/40 font-medium tracking-wide">
            PINTA TACOS
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors"
            >
              Instalar Conto
            </button>
          )}
          {isIOSDevice && !deferredPrompt && (
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <p className="text-xs text-muted text-left">
                1. Tocá el botón <span className="font-semibold text-white">Compartir</span> abajo
              </p>
              <p className="text-xs text-muted text-left">
                2. Seleccioná <span className="font-semibold text-white">Agregar a pantalla de inicio</span>
              </p>
              <div className="flex justify-center pt-1">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="MM4 12h12m0 0l-4-4m4 4l-4 4" />
                </svg>
              </div>
            </div>
          )}
          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-muted text-sm font-medium transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
