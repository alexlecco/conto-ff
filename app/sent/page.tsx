"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SentPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.removeItem("last_order_id");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="text-center space-y-8">
        <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">¡Pedido enviado!</h1>
          <p className="text-muted max-w-xs mx-auto">
            Estamos preparando tu pedido. En unos minutos lo tenés en tu mesa.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/orders")}
            className="bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-8 rounded-full transition-colors"
          >
            Ver mi pedido
          </button>
          <button
            onClick={() => router.push("/menu")}
            className="bg-card hover:bg-card-hover border border-border text-white font-semibold py-3 px-8 rounded-full transition-colors"
          >
            Volver al menú
          </button>
        </div>
      </div>
    </div>
  );
}
