"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
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

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  preparing: "bg-blue-500",
  ready: "bg-green-500",
};

export default function OrdersPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .neq("status", "delivered")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersData) {
        const ordersWithItems = await Promise.all(
          ordersData.map(async (order) => {
            const { data: items } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", order.id);
            return { ...order, items: items || [] };
          })
        );
        setOrders(ordersWithItems);
      }

      setLoading(false);
    };

    init();
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const updatedOrder = payload.new as Order;

          if (updatedOrder.status === "delivered") {
            setOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
          } else {
            const { data: items } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", updatedOrder.id);

            setOrders((prev) =>
              prev.map((o) =>
                o.id === updatedOrder.id
                  ? { ...updatedOrder, items: items || [] }
                  : o
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando pedidos...</div>
      </div>
    );
  }

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
          <h1 className="text-lg font-bold text-white">Tu pedido</h1>
        </div>
      </div>

      <div className="px-4 py-4" style={{ gap: "20px" }}>
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted mb-4">No tenés pedidos activos</p>
            <button
              onClick={() => router.push("/menu")}
              className="bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-6 rounded-full transition-colors"
            >
              Ir al menú
            </button>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "20px" }}>
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-card border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        statusColors[order.status] || "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm font-medium text-white">
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted">
                      Mesa {order.table_number}
                    </span>
                    <span className="text-xs text-muted block">
                      {new Date(order.created_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-white">
                          {item.quantity}x {item.product_name}
                        </span>
                        {item.variant_name && (
                          <span className="text-muted text-sm ml-1">
                            ({item.variant_name})
                          </span>
                        )}
                      </div>
                      <span className="text-white font-medium ml-2">
                        {formatPrice(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/50">
                  <span className="text-sm text-muted">Total</span>
                  <span className="font-bold text-white">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
