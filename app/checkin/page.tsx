"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CheckinPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tableNumber, setTableNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const num = parseInt(tableNumber, 10);
    if (isNaN(num) || num < 1 || num > 100) {
      setError("Ingresá un número de mesa válido (1-100)");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: insertError } = await supabase.from("check_ins").insert({
      user_id: user.id,
      table_number: num,
    });

    if (insertError) {
      setError("Error al registrar tu mesa. Intentá de nuevo.");
      setLoading(false);
      return;
    }

    localStorage.setItem("table_number", String(num));
    localStorage.setItem("customer_name", user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente");

    router.push("/menu");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">¿En qué mesa estás?</h1>
          <p className="text-sm text-muted">
            Ingresá el número de tu mesa para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => {
                setTableNumber(e.target.value);
                setError(null);
              }}
              placeholder="Número de mesa"
              min="1"
              max="100"
              className="w-full text-center text-4xl font-bold bg-card border border-border rounded-2xl py-6 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-center text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !tableNumber}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar al menú"}
          </button>
        </form>
      </div>
    </div>
  );
}
