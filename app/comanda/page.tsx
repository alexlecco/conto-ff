"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase, type DBOrder, type OrderEvent } from "@/lib/supabase/use-database";
import ImageModal from "@/components/image-modal";
import EmployeeNav from "@/components/employee-nav";
import { HALF_PIZZA_IMAGE } from "@/lib/utils";

interface Call {
  id: string;
  user_id: string;
  bar_id: string;
  table_number: number;
  customer_name: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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

const callStatusLabels: Record<string, string> = {
  submitted: "Enviada",
  attended: "Atendida",
  completed: "Completada",
};

const callNextStatus: Record<string, string> = {
  submitted: "attended",
  attended: "completed",
};

const callNextStatusLabel: Record<string, string> = {
  submitted: "Atender",
  attended: "Completar",
};

const ROLE_LABELS: Record<string, string> = {
  cocinero: "Cocinero",
  mesero: "Mozo",
  dj: "DJ",
  bartender: "Bartender",
};

const CALL_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3";

export default function ComandaPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const {
    fetchActiveOrders,
    updateOrderStatus,
    markOrderAsPayed,
    fetchOrderItems,
    subscribeToOrders,
    fetchActiveCalls,
    updateCallStatus,
    subscribeToCalls,
  } = useDatabase();
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuImageMap, setMenuImageMap] = useState<Record<string, string>>({});
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [employeeUserId, setEmployeeUserId] = useState("");
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [waiterTableInput, setWaiterTableInput] = useState("");
  const callSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    callSoundRef.current = new Audio(CALL_SOUND_URL);
    callSoundRef.current.volume = 0.7;
  }, []);

  const playCallSound = useCallback(() => {
    if (callSoundRef.current) {
      callSoundRef.current.currentTime = 0;
      callSoundRef.current.play().catch(() => {});
    }
  }, []);

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
        .select("user_type, full_name, role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.user_type !== "employee") {
        if (profile?.user_type === "admin") {
          router.push("/tracking");
        } else {
          router.push("/menu");
        }
        return;
      }

      setEmployeeName(profile.full_name || user.email?.split("@")[0] || "Empleado");
      setEmployeeRole(profile.role || "");
      setEmployeeUserId(user.id);

      const activeOrders = await fetchActiveOrders();
      setOrders(activeOrders);

      const activeCalls = await fetchActiveCalls();
      setCalls(activeCalls as Call[]);

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("name, image_url")
        .eq("bar_id", "bar-02-pin");
      const imgMap: Record<string, string> = {};
      for (const mi of menuItems || []) {
        if (mi.image_url) imgMap[mi.name] = mi.image_url;
      }
      setMenuImageMap(imgMap);

      setLoading(false);
    };

    init();
  }, [router, supabase, fetchActiveOrders, fetchActiveCalls]);

  const hydrateOrder = useCallback(
    async (order: DBOrder): Promise<DBOrder> => {
      if (order.items && order.items.length > 0) return order;
      const items = await fetchOrderItems(order.id);
      return { ...order, items };
    },
    [fetchOrderItems]
  );

  useEffect(() => {
    const unsubscribe = subscribeToOrders(async (event: OrderEvent) => {
      if (event.type === "DELETE") return;
      const o = event.order;
      const isActive = o.status !== "delivered" || (o.waiter_order === true && o.payed === false);

      if (event.type === "INSERT") {
        if (isActive) {
          const hydrated = await hydrateOrder(o);
          setOrders((prev) => [...prev, hydrated]);
        }
      } else if (event.type === "UPDATE") {
        if (isActive) {
          const hydrated = await hydrateOrder(o);
          setOrders((prev) =>
            prev.map((p) => (p.id === hydrated.id ? hydrated : p))
          );
        } else {
          setOrders((prev) => prev.filter((p) => p.id !== o.id));
        }
      }
    });

    return unsubscribe;
  }, [subscribeToOrders, hydrateOrder]);

  useEffect(() => {
    const unsubscribe = subscribeToCalls((event) => {
      if (event.type === "INSERT") {
        const newCall = event.call as unknown as Call;
        setCalls((prev) => [newCall, ...prev]);
        playCallSound();
      } else if (event.type === "UPDATE") {
        const updated = event.call as unknown as Call;
        if (updated.status === "completed") {
          setCalls((prev) => prev.filter((c) => c.id !== updated.id));
        } else {
          setCalls((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        }
      }
    });

    return unsubscribe;
  }, [subscribeToCalls, playCallSound]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch {
      const reverted = await fetchActiveOrders();
      setOrders(reverted);
    }
  };

  const handleMarkAsPayed = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await markOrderAsPayed(orderId);
    } catch {
      const reverted = await fetchActiveOrders();
      setOrders(reverted);
    }
  };

  const handleWaiterOrderSubmit = () => {
    const num = parseInt(waiterTableInput, 10);
    if (!num || num < 1 || num > 100) return;
    setShowWaiterModal(false);
    setWaiterTableInput("");
    router.push(`/employee/order?table=${num}`);
  };

  const handleCallStatus = async (callId: string) => {
    const call = calls.find((c) => c.id === callId);
    if (!call) return;
    const next = callNextStatus[call.status];
    if (!next) return;

    setCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, status: next } : c))
    );
    try {
      await updateCallStatus(callId, next);
      if (next === "completed") {
        setCalls((prev) => prev.filter((c) => c.id !== callId));
      }
    } catch {
      const reverted = await fetchActiveCalls();
      setCalls(reverted as Call[]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fab76b" }}>
        <div className="text-white">Cargando comanda...</div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[employeeRole] || employeeRole;

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#fab76b" }}>
      <div className="sticky top-0 z-40 border-b border-white/20 px-4 py-4" style={{ backgroundColor: "#fab76b" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EmployeeNav />
            <div>
              <h1 className="text-xl font-bold text-white">
                Comanda{employeeName && ` – ${employeeName}`}{roleLabel && ` – ${roleLabel}`}
              </h1>
              <p className="text-sm text-white/70">
                {orders.length} {orders.length === 1 ? "pedido activo" : "pedidos activos"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Botón: Pedir por el cliente */}
        <button
          onClick={() => setShowWaiterModal(true)}
          className="w-full mb-4 py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-transform active:scale-[0.98]"
          style={{ backgroundColor: "#b45309" }}
        >
          + Pedir por el cliente
        </button>

        {orders.length === 0 ? (
          <div className="text-center py-8">
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
                    {order.waiter_order && (
                      <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Mozo
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">
                      {order.table_number === 0 ? "Ventanilla" : `Mesa ${order.table_number}`}
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
                    {(order.items || []).map((item) => {
                      const isHalfPizza = item.product_name.includes("(½)");
                      const itemImage = isHalfPizza
                        ? HALF_PIZZA_IMAGE
                        : menuImageMap[item.product_name];
                      return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3"
                      >
                        {itemImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage}
                            alt={item.product_name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 cursor-pointer"
                            onClick={() => setModalImage({ src: itemImage, alt: item.product_name })}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900">
                            {item.quantity}x {item.product_name}
                            {item.variant_name && (
                              <span className="text-gray-500 text-sm ml-1">
                                ({item.variant_name})
                              </span>
                            )}
                          </span>
                          {item.notes && (
                            <p className="text-xs text-amber-600 mt-0.5 truncate">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {nextStatus[order.status] && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    <button
                      onClick={() =>
                        handleUpdateStatus(order.id, nextStatus[order.status])
                      }
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
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
                )}

                {order.waiter_order && order.status === "delivered" && !order.payed && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    <button
                      onClick={() => handleMarkAsPayed(order.id)}
                      className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
                      style={{ backgroundColor: "#16a34a" }}
                    >
                      Orden pagada
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Llamados de mesa */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-white mb-3">Llamados de mesa</h2>
          {calls.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-white/70">No hay llamados activos</p>
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: "12px" }}>
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="rounded-xl bg-white overflow-hidden shadow-lg"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          call.status === "submitted"
                            ? "bg-red-500"
                            : call.status === "attended"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                      />
                      <span className="font-semibold text-gray-900">
                        {callStatusLabels[call.status]}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">
                        Mesa {call.table_number}
                      </span>
                      <span className="text-xs text-gray-500 block">
                        {new Date(call.created_at).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-500">{call.customer_name}</p>
                    {call.message && (
                      <p className="text-sm text-gray-700 mt-1 italic">
                        &quot;{call.message}&quot;
                      </p>
                    )}
                  </div>

                  {callNextStatus[call.status] && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <button
                        onClick={() => handleCallStatus(call.id)}
                        className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
                        style={{
                          backgroundColor:
                            call.status === "submitted" ? "#f59e0b" : "#22c55e",
                        }}
                      >
                        {callNextStatusLabel[call.status]}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showWaiterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Nuevo pedido</h3>
            <p className="text-sm text-gray-500 mb-4">Ingresá el número de mesa</p>
            <input
              type="number"
              min={1}
              max={100}
              value={waiterTableInput}
              onChange={(e) => setWaiterTableInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleWaiterOrderSubmit()}
              placeholder="Ej: 5"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-200 text-gray-900 placeholder:text-gray-500 text-center text-2xl font-bold mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWaiterModal(false);
                  setWaiterTableInput("");
                }}
                className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleWaiterOrderSubmit}
                disabled={!waiterTableInput || parseInt(waiterTableInput, 10) < 1 || parseInt(waiterTableInput, 10) > 100}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "#b45309" }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}
