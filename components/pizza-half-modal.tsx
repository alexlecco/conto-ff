"use client";

import { useState } from "react";
import type { MenuItem } from "@/types/menu";
import { formatPrice } from "@/lib/utils";

export default function PizzaHalfModal({
  pizza,
  otherPizzas,
  onAddFull,
  onAddHalf,
  onClose,
}: {
  pizza: MenuItem;
  otherPizzas: MenuItem[];
  onAddFull: (pizza: MenuItem, notes: string) => void;
  onAddHalf: (pizza1: MenuItem, pizza2: MenuItem, notes: string) => void;
  onClose: () => void;
}) {
  const [isHalf, setIsHalf] = useState(false);
  const [selectedHalf, setSelectedHalf] = useState<MenuItem | null>(null);
  const [notes, setNotes] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const halfPriceA = (pizza.price || 0) / 2;
  const halfPriceB = selectedHalf ? (selectedHalf.price || 0) / 2 : 0;
  const totalHalfPrice = halfPriceA + halfPriceB;

  const handleConfirm = () => {
    if (isHalf && selectedHalf) {
      onAddHalf(pizza, selectedHalf, notes);
    } else {
      onAddFull(pizza, notes);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-t-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{pizza.name}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-border/50 text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {pizza.description && (
          <p className="text-sm text-muted">{pizza.description}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsHalf(false);
              setSelectedHalf(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              !isHalf
                ? "bg-primary text-white"
                : "bg-white/5 text-muted border border-white/10"
            }`}
          >
            Pizza completa
          </button>
          <button
            onClick={() => setIsHalf(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isHalf
                ? "bg-primary text-white"
                : "bg-white/5 text-muted border border-white/10"
            }`}
          >
            Mitad y mitad
          </button>
        </div>

        {isHalf && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Elegí la otra mitad:
            </p>

            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm"
            >
              <span className={selectedHalf ? "text-white" : "text-muted"}>
                {selectedHalf ? selectedHalf.name : "Seleccionar pizza..."}
              </span>
              <svg
                className={`w-4 h-4 text-muted transition-transform ${showDropdown ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {otherPizzas
                  .filter((p) => p.id !== pizza.id && p.available && p.price !== null)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedHalf(p);
                        setShowDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 text-sm transition-colors ${
                        selectedHalf?.id === p.id
                          ? "bg-primary/20 text-white"
                          : "bg-white/5 text-muted hover:bg-white/10"
                      }`}
                    >
                      <span>{p.name}</span>
                      <span>{formatPrice(p.price!)}</span>
                    </button>
                  ))}
              </div>
            )}

            {selectedHalf && (
              <div className="bg-white/5 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{pizza.name} (½)</span>
                  <span className="text-white">{formatPrice(halfPriceA)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{selectedHalf.name} (½)</span>
                  <span className="text-white">{formatPrice(halfPriceB)}</span>
                </div>
                <div className="border-t border-white/10 pt-1 mt-1 flex justify-between text-sm font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-primary">{formatPrice(totalHalfPrice)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!isHalf && (
          <div className="bg-white/5 rounded-xl p-3 flex justify-between">
            <span className="text-sm text-muted">Precio completo</span>
            <span className="text-sm font-semibold text-white">{formatPrice(pizza.price || 0)}</span>
          </div>
        )}

        <div>
          <p className="text-sm text-muted mb-2">Indicaciones (opcional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: sin morrones, extra queso..."
            rows={2}
            maxLength={200}
            className="w-full text-sm bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={isHalf && !selectedHalf}
          className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Agregar{isHalf && selectedHalf ? ` — ${formatPrice(totalHalfPrice)}` : ` — ${formatPrice(pizza.price || 0)}`}
        </button>
      </div>
    </div>
  );
}
