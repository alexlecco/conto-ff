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

export default function AdminHistoryPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("all");

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
        router.push(profile?.user_type === "employee" ? "/comanda" : "/menu");
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

  const filteredOrders =
    selectedDate === "all"
      ? orders
      : orders.filter((o) => {
          const orderDate = new Date(o.created_at).toISOString().split("T")[0];
          return orderDate === selectedDate;
        });

  const dates = [
    ...new Set(
      orders.map((o) => new Date(o.created_at).toISOString().split("T")[0])
    ),
  ]
    .sort()
    .reverse();

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const deliveredCount = filteredOrders.filter(
    (o) => o.status === "delivered"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#d9d9d9" }}>
      <div
        className="sticky top-0 z-40 border-b border-gray-300 px-4 py-4"
        style={{ backgroundColor: "#d9d9d9" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Historial</h1>
            <p className="text-sm text-gray-600">
              {filteredOrders.length} pedidos &middot;{" "}
              {formatPrice(totalRevenue)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/tracking")}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-300"
            >
              Tracking
            </button>
            <button
              onClick={() => router.push("/admin/menu")}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-300"
            >
              Menú
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedDate("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedDate === "all"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-300"
            }`}
          >
            Todos ({orders.length})
          </button>
          {dates.map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedDate === date
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-300"
              }`}
            >
              {new Date(date + "T12:00:00").toLocaleDateString("es-AR", {
                day: "numeric",
                month: "short",
              })}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-white border border-gray-300 px-3 py-2 flex-1">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-sm font-bold text-gray-900">
              {formatPrice(totalRevenue)}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-300 px-3 py-2 flex-1">
            <div className="text-xs text-gray-500">Pedidos</div>
            <div className="text-sm font-bold text-gray-900">
              {filteredOrders.length}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-gray-300 px-3 py-2 flex-1">
            <div className="text-xs text-gray-500">Entregados</div>
            <div className="text-sm font-bold text-gray-900">
              {deliveredCount}
            </div>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No hay pedidos para esta fecha</p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "12px" }}>
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-white border border-gray-300 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        statusColors[order.status] || "bg-gray-500"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      Mesa {order.table_number}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {new Date(order.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">
                    {order.customer_name}
                  </p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-900">
                          {item.quantity}x {item.product_name}
                          {item.variant_name && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({item.variant_name})
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
                  <span className="text-xs text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-900">
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
