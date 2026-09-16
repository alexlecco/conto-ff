"use client";

import { useState, useEffect } from "react";

const LAST_VERSION_INFO_BAR = true;
const STORAGE_KEY = "conto_last_seen_version";

interface VersionData {
  version: string;
  deployTime: string;
}

export default function VersionBar() {
  const [showNew, setShowNew] = useState(false);
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState("");
  const [deployTime, setDeployTime] = useState("");

  useEffect(() => {
    if (!LAST_VERSION_INFO_BAR) return;

    fetch("/version.json")
      .then((r) => r.json())
      .then((data: VersionData) => {
        setVersion(data.version);
        setDeployTime(
          new Date(data.deployTime).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        );
        setVisible(true);

        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (lastSeen !== data.version) {
          setShowNew(true);
          localStorage.setItem(STORAGE_KEY, data.version);
          setTimeout(() => setShowNew(false), 5000);
        }
      })
      .catch(() => {});
  }, []);

  if (!LAST_VERSION_INFO_BAR || !visible) return null;

  return (
    <div
      className="w-full text-center text-[10px] font-medium py-1 px-3 flex items-center justify-center gap-2"
      style={{ backgroundColor: "#fab76b", color: "#1a1a1a" }}
    >
      <span>v{version}</span>
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
