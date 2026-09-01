"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import type { CartItem } from "@/types/menu";
import { formatPrice } from "@/lib/utils";

export default function ConfirmPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState(0);
  const [customerName, setCustomerName] = useState("Cliente");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const savedCart = localStorage.getItem("cart");
      const savedTable = localStorage.getItem("table_number");

      if (!savedCart || !savedTable) {
        router.push("/menu");
        return;
      }

      setCart(JSON.parse(savedCart));
      setTableNumber(parseInt(savedTable, 10));

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCustomerName(
          user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente"
        );
      }

      setReady(true);
    };

    init();
  }, [router, supabase]);

  const subtotal = cart.reduce(
    (sum, ci) => sum + (ci.variant?.price || ci.product.price || 0) * ci.quantity,
    0
  );

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index].quantity += delta;
      if (updated[index].quantity <= 0) {
        updated.splice(index, 1);
      }
      if (updated.length === 0) {
        localStorage.removeItem("cart");
        router.push("/menu");
        return [];
      }
      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_number: tableNumber,
          items: cart.map((ci) => ({
            product_id: ci.product.id,
            product_name: ci.product.name,
            variant_id: ci.variant?.id || null,
            variant_name: ci.variant?.name || null,
            quantity: ci.quantity,
            unit_price: ci.variant?.price || ci.product.price || 0,
            subtotal: (ci.variant?.price || ci.product.price || 0) * ci.quantity,
          })),
          total: subtotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el pedido");
      }

      localStorage.removeItem("cart");
      localStorage.setItem("last_order_id", data.order_id);
      router.push("/sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el pedido");
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/menu")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border text-muted hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Tu pedido</h1>
            <p className="text-sm text-muted">
              Mesa {tableNumber} · {customerName}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {cart.map((ci, index) => (
          <div
            key={`${ci.product.id}-${ci.variant?.id}`}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border"
          >
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white truncate">{ci.product.name}</h4>
              {ci.variant && (
                <p className="text-sm text-muted truncate">{ci.variant.name}</p>
              )}
              <p className="text-sm text-white mt-1">
                {formatPrice(ci.variant?.price || ci.product.price || 0)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => updateQuantity(index, -1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-border/50 text-white hover:bg-border transition-colors"
              >
                −
              </button>
              <span className="w-6 text-center text-white font-medium">
                {ci.quantity}
              </span>
              <button
                onClick={() => updateQuantity(index, 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-muted">Subtotal</span>
            <span className="text-xl font-bold text-white">{formatPrice(subtotal)}</span>
          </div>

          {error && (
            <p className="text-sm text-center text-red-400">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || cart.length === 0}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
