"use client";

import { useState, useEffect, useCallback, useRef } from "react";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const INSTALLED_KEY = "conto_app_installed";
const DISMISSED_KEY = "conto_install_dismissed";
const LAST_SHOWN_KEY = "conto_install_last_shown";
const FIVE_MINUTES = 5 * 60 * 1000;

export function useInstallPrompt(userType?: string) {
  const [showModal, setShowModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const installed = isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true";
    setIsInstalled(installed);
    setIsIOSDevice(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  }, []);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const markInstalled = useCallback(() => {
    setIsInstalled(true);
    localStorage.setItem(INSTALLED_KEY, "true");
    setShowModal(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      markInstalled();
    }
    setDeferredPrompt(null);
    setShowModal(false);
  }, [deferredPrompt, markInstalled]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    if (userType === "regular") {
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } else {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
  }, [userType]);

  const openManual = useCallback(() => {
    setShowModal(true);
  }, []);

  // Auto-show logic for admin/employee: show once on first load, then never again
  useEffect(() => {
    if (isInstalled) return;
    if (userType !== "admin" && userType !== "employee") return;

    const dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    if (dismissed) return;

    const timer = setTimeout(() => setShowModal(true), 2000);
    return () => clearTimeout(timer);
  }, [isInstalled, userType]);

  // Auto-show logic for regular users on /sent: every 5 minutes
  useEffect(() => {
    if (isInstalled) return;
    if (userType !== "regular") return;

    const checkAndShow = () => {
      const lastShown = parseInt(localStorage.getItem(LAST_SHOWN_KEY) || "0", 10);
      if (Date.now() - lastShown > FIVE_MINUTES) {
        setShowModal(true);
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      }
    };

    // Initial check after 2s (for /sent page)
    const timer = setTimeout(checkAndShow, 2000);

    // Periodic check every minute
    intervalRef.current = setInterval(checkAndShow, 60 * 1000);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isInstalled, userType]);

  return {
    showModal,
    isInstalled,
    isIOSDevice,
    deferredPrompt,
    handleInstall,
    handleDismiss,
    openManual,
  };
}
