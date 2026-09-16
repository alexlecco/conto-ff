"use client";

import { useState, useEffect } from "react";

const APP_VERSION = "0.2.0";
const LAST_VERSION_INFO_BAR = true;
const STORAGE_KEY = "conto_last_seen_version";

export default function VersionBar() {
  const [showNew, setShowNew] = useState(false);
  const [visible, setVisible] = useState(false);
  const [deployTime, setDeployTime] = useState("");

  useEffect(() => {
    if (!LAST_VERSION_INFO_BAR) return;
    setDeployTime(
      new Date().toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    setVisible(true);
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== APP_VERSION) {
      setShowNew(true);
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
      const timer = setTimeout(() => setShowNew(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!LAST_VERSION_INFO_BAR || !visible) return null;

  return (
    <div
      className="w-full text-center text-[10px] font-medium py-1 px-3 flex items-center justify-center gap-2"
      style={{ backgroundColor: "#fab76b", color: "#1a1a1a" }}
    >
      <span>v{APP_VERSION}</span>
      <span className="opacity-50">·</span>
      <span>{deployTime}</span>
      {showNew && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/30 animate-pulse">
          NEW DEPLOY
        </span>
      )}
    </div>
  );
}
