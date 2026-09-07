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
  delivered: "bg-gray-500",
};

export default function OrderHistoryPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("all");

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

  const filteredOrders = selectedDate === "all"
    ? orders
    : orders.filter((o) => {
        const orderDate = new Date(o.created_at).toISOString().split("T")[0];
        return orderDate === selectedDate;
      });

  const dates = [...new Set(orders.map((o) => new Date(o.created_at).toISOString().split("T")[0]))].sort().reverse();

  const totalSpent = filteredOrders.reduce((sum, o) => sum + o.total, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando historial...</div>
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
          <h1 className="text-lg font-bold text-white">Historial de pedidos</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
          <button
            onClick={() => setSelectedDate("all")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedDate === "all"
                ? "bg-primary text-white"
                : "bg-card text-muted border border-border"
            }`}
          >
            Todos ({orders.length})
          </button>
          {dates.map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDate === date
                  ? "bg-primary text-white"
                  : "bg-card text-muted border border-border"
              }`}
            >
              {new Date(date + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted">
            {filteredOrders.length} {filteredOrders.length === 1 ? "pedido" : "pedidos"}
          </span>
          <span className="text-sm font-semibold text-white">
            Total: {formatPrice(totalSpent)}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">No hay pedidos para esta fecha</p>
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
                      {new Date(order.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
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
    </div>
  );
}