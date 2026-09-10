"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase, type DBOrder, type DBOrderItem, type OrderEvent } from "@/lib/supabase/use-database";
import { formatPrice } from "@/lib/utils";

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

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const playBell = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    playBell(880, now, 0.15);
    playBell(1100, now + 0.12, 0.15);
    playBell(880, now + 0.25, 0.2);
  } catch {
    // Silently fail if audio is not available
  }
};

function NoteModal({
  note,
  onSave,
  onClose,
}: {
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-t-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Indicación para el cocinero</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-border/50 text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: carne a punto, solo mayonesa y tomate..."
          rows={3}
          maxLength={200}
          className="w-full text-sm bg-background border border-border rounded-xl p-3 text-white placeholder-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={() => {
              onSave(text);
              onClose();
            }}
            className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { fetchActiveOrders, fetchOrderItems, subscribeToOrders, updateOrderItemNotes } = useDatabase();
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastStatusChange, setLastStatusChange] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ itemId: string; currentNote: string } | null>(null);

  const hydrateOrder = useCallback(
    async (order: DBOrder): Promise<DBOrder> => {
      if (order.items && order.items.length > 0) return order;
      const items = await fetchOrderItems(order.id);
      return { ...order, items };
    },
    [fetchOrderItems]
  );

  useEffect(() => {
    const init = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const activeOrders = await fetchActiveOrders(user.id);
      setOrders(activeOrders);
      setLoading(false);
    };

    init();
  }, [router, supabase, fetchActiveOrders]);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(async (event: OrderEvent) => {
      if (event.type === "UPDATE") {
        const updated = event.order;

        if (updated.status === "delivered") {
          setOrders((prev) => prev.filter((o) => o.id !== updated.id));
          playNotificationSound();
          setLastStatusChange("Tu pedido fue entregado");
          setTimeout(() => setLastStatusChange(null), 5000);
        } else {
          const hydrated = await hydrateOrder(updated);
          setOrders((prev) =>
            prev.map((o) => (o.id === hydrated.id ? hydrated : o))
          );
          playNotificationSound();
          const label = statusLabels[hydrated.status] || hydrated.status;
          setLastStatusChange(`Tu pedido ahora está: ${label}`);
          setTimeout(() => setLastStatusChange(null), 5000);
        }
      }
    });

    return unsubscribe;
  }, [subscribeToOrders, hydrateOrder]);

  const handleSaveNote = async (notes: string) => {
    if (!editingNote) return;
    try {
      await updateOrderItemNotes(editingNote.itemId, notes || null);
      setOrders((prev) =>
        prev.map((order) => ({
          ...order,
          items: order.items?.map((item) =>
            item.id === editingNote.itemId ? { ...item, notes: notes || null } : item
          ),
        }))
      );
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border text-muted hover:text-white transition-colors"
            >
              ←
            </button>
            <h1 className="text-lg font-bold text-white">Tu pedido</h1>
          </div>
          <button
            onClick={() => router.push("/orders/history")}
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Historial
          </button>
        </div>
      </div>

      {lastStatusChange && (
        <div className="mx-4 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-sm text-green-400 text-center">{lastStatusChange}</p>
        </div>
      )}

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
                  {(order.items || []).map((item) => (
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
                        {item.notes && (
                          <p className="text-xs text-primary mt-0.5 truncate">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={() =>
                            setEditingNote({
                              itemId: item.id,
                              currentNote: item.notes || "",
                            })
                          }
                          className="flex-shrink-0 text-xs text-muted hover:text-white transition-colors px-2 py-1 rounded-lg border border-border"
                        >
                          {item.notes ? "editar" : "indicación"}
                        </button>
                        <span className="text-white font-medium">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
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

      {editingNote && (
        <NoteModal
          note={editingNote.currentNote}
          onSave={handleSaveNote}
          onClose={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}
