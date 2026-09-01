"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  preparing: "bg-blue-500",
  ready: "bg-green-500",
  delivered: "bg-gray-500",
};

export default function TrackingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

      if (!profile || profile.user_type !== "admin") {
        if (profile?.user_type === "employee") {
          router.push("/comanda");
        } else {
          router.push("/menu");
        }
        return;
      }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
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
    const channel = supabase
      .channel("tracking-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as Order;
            const { data: items } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", newOrder.id);
            setOrders((prev) => [{ ...newOrder, items: items || [] }, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedOrder = payload.new as Order;
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

  const filteredOrders = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter);

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando tracking...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Tracking</h1>
            <p className="text-sm text-muted">
              {orders.length} pedidos totales
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.clear();
              router.push("/login");
            }}
            className="text-sm text-muted hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-white text-black"
                : "bg-card text-muted border border-border"
            }`}
          >
            Todos ({orders.length})
          </button>
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-white text-black"
                  : "bg-card text-muted border border-border"
              }`}
            >
              {label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">No hay pedidos</p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "16px" }}>
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-card border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        statusColors[order.status] || "bg-gray-500"
                      }`}
                    />
                    <span className="font-semibold text-white">
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">
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

                <div className="px-4 py-3">
                  <p className="text-sm text-muted mb-2">{order.customer_name}</p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-white">
                          {item.quantity}x {item.product_name}
                          {item.variant_name && (
                            <span className="text-muted text-sm ml-1">
                              ({item.variant_name})
                            </span>
                          )}
                        </span>
                        <span className="text-muted text-sm">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
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
    </div>
  );
}
