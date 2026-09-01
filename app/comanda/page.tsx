"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
};

const nextStatus: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
  ready: "delivered",
};

const nextStatusLabel: Record<string, string> = {
  pending: "Preparar",
  preparing: "Marcar listo",
  ready: "Entregar",
};

export default function ComandaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

      if (!profile || (profile.user_type !== "employee" && profile.user_type !== "admin")) {
        router.push("/menu");
        return;
      }

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .neq("status", "delivered")
        .order("created_at", { ascending: true });

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
      .channel("comanda-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const newOrder = payload.new as Order;
          if (newOrder.status !== "delivered") {
            const { data: items } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", newOrder.id);
            setOrders((prev) => [...prev, { ...newOrder, items: items || [] }]);
          }
        }
      )
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

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      console.error("Error updating order:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fab76b" }}>
        <div className="text-white">Cargando comanda...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#fab76b" }}>
      <div className="sticky top-0 z-40 border-b border-white/20 px-4 py-4" style={{ backgroundColor: "#fab76b" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Comanda</h1>
            <p className="text-sm text-white/70">
              {orders.length} {orders.length === 1 ? "pedido activo" : "pedidos activos"}
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.clear();
              router.push("/login");
            }}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/70 text-lg">No hay pedidos activos</p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: "20px" }}>
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-white overflow-hidden shadow-lg"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        statusColors[order.status] || "bg-gray-400"
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
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() =>
                      updateStatus(order.id, nextStatus[order.status])
                    }
                    className="w-full py-3 px-4 rounded-xl font-semibold text-white transition-colors"
                    style={{
                      backgroundColor:
                        order.status === "pending"
                          ? "#3b82f6"
                          : order.status === "preparing"
                          ? "#22c55e"
                          : "#6b7280",
                    }}
                  >
                    {nextStatusLabel[order.status]}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
