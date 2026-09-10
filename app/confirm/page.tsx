"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";
import type { CartItem } from "@/types/menu";
import { formatPrice } from "@/lib/utils";

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

export default function ConfirmPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { createOrder } = useDatabase();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState(0);
  const [customerName, setCustomerName] = useState("Cliente");
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionTime, setSubmissionTime] = useState<Date | null>(null);
  const [editingNote, setEditingNote] = useState<{ index: number; currentNote: string } | null>(null);

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
        setUserId(user.id);
        setCustomerName(
          user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente"
        );
      }
    };

    init();
  }, [router, supabase]);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem("cart", JSON.stringify(cart));
    }
  }, [cart]);

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
      return updated;
    });
  };

  const updateNote = (index: number, notes: string) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], notes: notes || undefined };
      return updated;
    });
  };

  const handleConfirm = async () => {
    if (isSubmitting || !userId) return;
    setIsSubmitting(true);
    setSubmissionTime(new Date());

    try {
      const orderId = await createOrder(
        userId,
        customerName,
        tableNumber,
        cart.map((ci) => ({
          product_id: ci.product.id,
          product_name: ci.product.name,
          variant_id: ci.variant?.id || null,
          variant_name: ci.variant?.name || null,
          quantity: ci.quantity,
          unit_price: ci.variant?.price || ci.product.price || 0,
          subtotal: (ci.variant?.price || ci.product.price || 0) * ci.quantity,
          notes: ci.notes || null,
        })),
        subtotal
      );

      localStorage.removeItem("cart");
      localStorage.setItem("last_order_id", orderId);

      setTimeout(() => {
        setIsSubmitting(false);
        setSubmissionTime(null);
      }, 3000);

      router.push("/sent");
    } catch {
      setIsSubmitting(false);
      setSubmissionTime(null);
    }
  };

  if (isSubmitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Enviando pedido...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
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
              {ci.notes && (
                <p className="text-xs text-primary mt-1 truncate">{ci.notes}</p>
              )}
              <p className="text-sm text-white mt-1">
                {formatPrice(ci.variant?.price || ci.product.price || 0)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setEditingNote({ index, currentNote: ci.notes || "" })
                }
                className="flex-shrink-0 text-xs text-muted hover:text-white transition-colors px-2 py-1 rounded-lg border border-border"
              >
                {ci.notes ? "editar" : "indicación"}
              </button>
              <div className="flex items-center gap-1">
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
          </div>
        ))}

        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t border-border">
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-muted">Subtotal</span>
              <span className="text-xl font-bold text-white">{formatPrice(subtotal)}</span>
            </div>

            {isSubmitting ? (
              <p className="text-sm text-center text-green-400">Pedido enviado</p>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={isSubmitting || cart.length === 0}
                className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Enviando..." : "Confirmar pedido"}
              </button>
            )}

            {submissionTime && !isSubmitting && (
              <p className="text-sm text-center text-green-400 mt-2">Pedido enviado hace instantes</p>
            )}
          </div>
        </div>
      </div>

      {editingNote && (
        <NoteModal
          note={editingNote.currentNote}
          onSave={(text) => updateNote(editingNote.index, text)}
          onClose={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}
