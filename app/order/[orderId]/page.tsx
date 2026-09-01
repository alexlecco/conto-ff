"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  customer_name: string;
  table_number: number;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch(`/api/orders/${params.orderId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al cargar la orden");
        }

        setOrder(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params.orderId, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando pedido...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <p className="text-red-400 mb-4">{error || "Orden no encontrada"}</p>
        <button
          onClick={() => router.push("/menu")}
          className="bg-card hover:bg-card-hover border border-border text-white font-semibold py-3 px-6 rounded-full transition-colors"
        >
          Volver al menú
        </button>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    preparing: "En preparación",
    ready: "Listo",
    delivered: "Entregado",
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border text-muted hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Tu pedido</h1>
            <p className="text-sm text-muted">
              Mesa {order.table_number} · {order.customer_name}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border">
          <div className={`w-2 h-2 rounded-full ${order.status === "pending" ? "bg-yellow-500" : order.status === "preparing" ? "bg-blue-500" : "bg-green-500"}`} />
          <span className="text-sm text-white">
            {statusLabels[order.status] || order.status}
          </span>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate">{item.product_name}</h4>
                {item.variant_name && (
                  <p className="text-sm text-muted truncate">{item.variant_name}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted">{item.quantity}x</span>
                <span className="text-white font-medium">{formatPrice(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
          <span className="text-muted">Total</span>
          <span className="text-xl font-bold text-white">{formatPrice(order.total)}</span>
        </div>

        <p className="text-xs text-center text-muted">
          {new Date(order.created_at).toLocaleString("es-AR")}
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border">
        <button
          onClick={() => router.push("/menu")}
          className="w-full max-w-lg mx-auto bg-card hover:bg-card-hover border border-border text-white font-semibold py-4 px-6 rounded-full transition-colors"
        >
          Volver al menú
        </button>
      </div>
    </div>
  );
}
