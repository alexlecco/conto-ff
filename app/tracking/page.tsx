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
  const supabase = useSupabase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
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
    if (!supabase) return;
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
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#d9d9d9" }}>
      <div className="sticky top-0 z-40 border-b border-gray-300 px-4 py-4" style={{ backgroundColor: "#d9d9d9" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tracking</h1>
            <p className="text-sm text-gray-600">
              {orders.length} pedidos totales
            </p>
          </div>
          <button
            onClick={async () => {
              if (supabase) await supabase.auth.signOut();
              localStorage.clear();
              router.push("/login");
            }}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Salir
          </button>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-300"
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
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-300"
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
            <p className="text-gray-600">No hay pedidos</p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "16px" }}>
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-white border border-gray-300 overflow-hidden shadow-sm"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        statusColors[order.status] || "bg-gray-500"
                      }`}
                    />
                    <span className="font-semibold text-gray-900">
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">
                      Mesa {order.table_number}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {new Date(order.created_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <p className="text-sm text-gray-500 mb-2">{order.customer_name}</p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-gray-900">
                          {item.quantity}x {item.product_name}
                          {item.variant_name && (
                            <span className="text-gray-500 text-sm ml-1">
                              ({item.variant_name})
                            </span>
                          )}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">
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
