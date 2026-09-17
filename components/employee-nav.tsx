"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import InstallPrompt from "@/components/install-prompt";

const NAV_ITEMS = [
  { href: "/comanda", label: "Comanda", icon: "📋" },
  { href: "/employee/history", label: "Historial", icon: "📊" },
];

export default function EmployeeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);

  const {
    showModal,
    isInstalled,
    isIOSDevice,
    deferredPrompt,
    handleInstall,
    handleDismiss,
    openManual,
  } = useInstallPrompt("employee");

  const handleLogout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.clear();
    router.push("/login");
  }, [supabase, router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col gap-[5px] w-7 p-0 bg-transparent border-none cursor-pointer"
        aria-label="Menú"
      >
        <span className="block h-[2px] w-full rounded-full" style={{ backgroundColor: "#1a1a1a" }} />
        <span className="block h-[2px] w-full rounded-full" style={{ backgroundColor: "#1a1a1a" }} />
        <span className="block h-[2px] w-full rounded-full" style={{ backgroundColor: "#1a1a1a" }} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-72 z-[90] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Empleado
          </span>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            ✕
          </button>
        </div>

        <nav className="px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                pathname === item.href
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <button
            onClick={() => {
              setOpen(false);
              // Non-functional for now
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-base">✏️</span>
            Editar perfil
          </button>

          {!isInstalled && (
            <button
              onClick={() => {
                setOpen(false);
                openManual();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="text-base">📱</span>
              Instalar app
            </button>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <span className="text-base">🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>

      {!isInstalled && (
        <InstallPrompt
          show={showModal}
          isInstalled={isInstalled}
          isIOSDevice={isIOSDevice}
          deferredPrompt={deferredPrompt}
          onInstall={handleInstall}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
