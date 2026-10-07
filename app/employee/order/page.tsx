"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";
import type { MenuCategory, MenuItem, MenuItemVariant, CartItem } from "@/types/menu";
import { formatPrice, halfPizzaTotalPrice, HALF_PIZZA_IMAGE } from "@/lib/utils";
import ImageModal from "@/components/image-modal";
import PizzaHalfModal from "@/components/pizza-half-modal";

function VariantSelector({
  item,
  onSelect,
  onClose,
}: {
  item: MenuItem;
  onSelect: (variant: MenuItemVariant) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<MenuItemVariant | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ✕
          </button>
        </div>

        {item.description && (
          <p className="text-sm text-gray-500">{item.description}</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">Elegí una opción:</p>
          {item.variants.filter((v) => v.available).map((variant) => (
            <button
              key={variant.id}
              onClick={() => setSelected(variant)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                selected?.id === variant.id
                  ? "border-amber-500 bg-amber-50"
                  : "border-gray-200 bg-gray-100 hover:border-gray-300"
              }`}
            >
              <span className="text-gray-900 font-medium">{variant.name}</span>
              <span className="text-gray-900 font-semibold">{formatPrice(variant.price)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className="w-full text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#b45309" }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function MenuItemComponent({
  item,
  categoryId,
  onAdd,
  onPizzaAdd,
}: {
  item: MenuItem;
  categoryId: string;
  onAdd: (item: MenuItem, variant: MenuItemVariant | null) => void;
  onPizzaAdd: (item: MenuItem) => void;
}) {
  const [showVariants, setShowVariants] = useState(false);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const hasVariants = item.variants.length > 0;
  const availableVariants = item.variants.filter((v) => v.available);
  const isAvailable = item.available && (hasVariants ? availableVariants.length > 0 : item.price !== null);
  const isPizza = categoryId === "pizzas";

  const handleAdd = () => {
    if (!isAvailable) return;
    if (isPizza) {
      onPizzaAdd(item);
      return;
    }
    if (hasVariants) {
      if (availableVariants.length === 1) {
        onAdd(item, availableVariants[0]);
      } else {
        setShowVariants(true);
      }
    } else {
      onAdd(item, null);
    }
  };

  return (
    <>
      <div
        className={`flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 transition-colors ${
          isAvailable ? "hover:border-gray-300 cursor-pointer" : "opacity-50"
        }`}
        onClick={handleAdd}
      >
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-gray-500 truncate mt-0.5">{item.description}</p>
          )}
          <div className="mt-2">
            {hasVariants ? (
              <div className="flex flex-wrap gap-1">
                {availableVariants.slice(0, 3).map((v) => (
                  <span key={v.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {v.name}: {formatPrice(v.price)}
                  </span>
                ))}
                {availableVariants.length > 3 && (
                  <span className="text-xs text-gray-500">+{availableVariants.length - 3}</span>
                )}
              </div>
            ) : (
              <span className="text-gray-900 font-semibold">{formatPrice(item.price!)}</span>
            )}
          </div>
        </div>

        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 rounded-lg object-cover shrink-0 border border-gray-200 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setModalImage({ src: item.image_url!, alt: item.name });
            }}
          />
        )}

        {isAvailable && (
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-white text-xl font-bold"
            style={{ backgroundColor: "#b45309" }}
          >
            +
          </div>
        )}
      </div>

      {showVariants && (
        <VariantSelector
          item={item}
          onSelect={(variant) => {
            onAdd(item, variant);
            setShowVariants(false);
          }}
          onClose={() => setShowVariants(false)}
        />
      )}

      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </>
  );
}

function EmployeeOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();
  const { createOrder } = useDatabase();

  const tableNumber = parseInt(searchParams.get("table") || "0", 10);

  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [employeeName, setEmployeeName] = useState("");
  const [userId, setUserId] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pizzaModalItem, setPizzaModalItem] = useState<MenuItem | null>(null);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

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
        .select("user_type, full_name")
        .eq("id", user.id)
        .single();

      if (!profile || profile.user_type !== "employee") {
        router.push(profile?.user_type === "admin" ? "/tracking" : "/menu");
        return;
      }

      setEmployeeName(profile.full_name || user.email?.split("@")[0] || "Empleado");
      setUserId(user.id);

      if (!tableNumber || tableNumber < 1 || tableNumber > 100) {
        router.push("/comanda");
        return;
      }

      const response = await fetch("/api/menu");
      const data = await response.json();
      const menuData = data.categories || data;
      setMenu(menuData);
      if (menuData.length > 0) {
        setActiveCategory(menuData[0].id);
      }
      setLoading(false);
    };

    init();
  }, [supabase, router, tableNumber]);

  const addToCart = (item: MenuItem, variant: MenuItemVariant | null, notes?: string, halfPizza?: MenuItem) => {
    setCart((prev) => [...prev, { product: item, variant, quantity: 1, notes: notes || undefined, halfPizza }]);
  };

  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0);
  const subtotal = cart.reduce(
    (sum, ci) => {
      if (ci.halfPizza) {
        return sum + halfPizzaTotalPrice(ci.product.price || 0, ci.halfPizza.price || 0) * ci.quantity;
      }
      return sum + (ci.variant?.price || ci.product.price || 0) * ci.quantity;
    },
    0
  );

  const getItemQuantity = (productId: string, variantId?: string) => {
    return cart
      .filter(
        (ci) =>
          ci.product.id === productId &&
          (variantId ? ci.variant?.id === variantId : true)
      )
      .reduce((sum, ci) => sum + ci.quantity, 0);
  };

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !userId || cart.length === 0) return;
    setIsSubmitting(true);

    try {
      await createOrder(
        userId,
        `Cliente Mesa ${tableNumber}`,
        tableNumber,
        cart.map((ci) => {
          const isHalf = !!ci.halfPizza;
          const unitPrice = isHalf
            ? halfPizzaTotalPrice(ci.product.price || 0, ci.halfPizza!.price || 0)
            : ci.variant?.price || ci.product.price || 0;
          return {
            product_id: ci.product.id,
            product_name: isHalf
              ? `${ci.product.name} (½) + ${ci.halfPizza!.name} (½)`
              : ci.product.name,
            variant_id: ci.variant?.id || null,
            variant_name: ci.variant?.name || null,
            quantity: ci.quantity,
            unit_price: unitPrice,
            subtotal: unitPrice * ci.quantity,
            notes: ci.notes || null,
          };
        }),
        subtotal,
        { waiterOrder: true, payed: false }
      );

      router.push("/comanda");
    } catch {
      setIsSubmitting(false);
    }
  }, [isSubmitting, userId, cart, tableNumber, subtotal, createOrder, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fab76b" }}>
        <div className="text-white">Cargando menú...</div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fab76b" }}>
        <div className="text-white">Enviando pedido...</div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="min-h-screen pb-24" style={{ backgroundColor: "#fab76b" }}>
        <div className="sticky top-0 z-40 border-b border-white/20 px-4 py-4" style={{ backgroundColor: "#fab76b" }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowConfirm(false)}
              className="text-white font-semibold text-sm"
            >
              ← Volver
            </button>
            <h1 className="text-xl font-bold text-white">Confirmar pedido</h1>
            <div className="w-16" />
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="bg-white rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-500">Mesa</p>
            <p className="text-2xl font-bold text-gray-900">{tableNumber}</p>
            <p className="text-sm text-gray-500 mt-2">Mozo</p>
            <p className="text-gray-900">{employeeName}</p>
          </div>

          <div className="bg-white rounded-xl p-4 mb-4">
            <h2 className="font-bold text-gray-900 mb-3">Productos</h2>
            <div className="space-y-3">
              {cart.map((ci, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  {(ci.halfPizza ? HALF_PIZZA_IMAGE : ci.product.image_url) && (
                    <img
                      src={ci.halfPizza ? HALF_PIZZA_IMAGE : ci.product.image_url!}
                      alt={ci.product.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900">
                      {ci.quantity}x {ci.product.name}
                      {ci.variant && (
                        <span className="text-gray-500 text-sm ml-1">({ci.variant.name})</span>
                      )}
                      {ci.halfPizza && (
                        <span className="text-gray-500 text-sm ml-1">(½ + ½ {ci.halfPizza.name})</span>
                      )}
                    </p>
                    {ci.notes && (
                      <p className="text-xs text-amber-600 mt-0.5">{ci.notes}</p>
                    )}
                  </div>
                  <span className="text-gray-900 font-semibold shrink-0">
                    {formatPrice(
                      ci.halfPizza
                        ? halfPizzaTotalPrice(ci.product.price || 0, ci.halfPizza.price || 0) * ci.quantity
                        : (ci.variant?.price || ci.product.price || 0) * ci.quantity
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-900">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatPrice(subtotal)}</span>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg"
            style={{ backgroundColor: "#16a34a" }}
          >
            Enviar pedido a cocina
          </button>
        </div>

        {pizzaModalItem && (
          <PizzaHalfModal
            pizza={pizzaModalItem}
            otherPizzas={menu.find((c) => c.id === "pizzas")?.items || []}
            onAddFull={(pizza, notes) => {
              addToCart(pizza, null, notes);
              setPizzaModalItem(null);
            }}
            onAddHalf={(pizza1, pizza2, notes) => {
              addToCart(pizza1, null, notes, pizza2);
              setPizzaModalItem(null);
            }}
            onClose={() => setPizzaModalItem(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#fab76b" }}>
      <div className="sticky top-0 z-40 border-b border-white/20" style={{ backgroundColor: "#fab76b" }}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/comanda")}
              className="text-white font-semibold text-sm"
            >
              ← Comanda
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">Pedido para Mesa {tableNumber}</h1>
              <p className="text-sm text-white/70">{employeeName}</p>
            </div>
            <div className="w-16" />
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {menu.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                document
                  .getElementById(`cat-${cat.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "text-white"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
              style={activeCategory === cat.id ? { backgroundColor: "#b45309" } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-8">
        {menu.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <h2 className="text-lg font-bold text-white mb-3">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items
                .filter(
                  (item) =>
                    item.available &&
                    (item.price !== null || item.variants.some((v) => v.available))
                )
                .map((item) => {
                  const qty = getItemQuantity(
                    item.id,
                    item.variants.length === 1 ? item.variants[0].id : undefined
                  );
                  return (
                    <div key={item.id} className="relative">
                      <MenuItemComponent item={item} categoryId={cat.id} onAdd={addToCart} onPizzaAdd={setPizzaModalItem} />
                      {qty > 0 && (
                        <div
                          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-white text-xs font-bold rounded-full"
                          style={{ backgroundColor: "#b45309" }}
                        >
                          {qty}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full max-w-lg mx-auto flex items-center justify-between text-white font-semibold py-4 px-6 rounded-full transition-colors shadow-lg"
            style={{ backgroundColor: "#b45309" }}
          >
            <span>
              {totalItems} {totalItems === 1 ? "producto" : "productos"}
            </span>
            <span className="text-lg">{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      {pizzaModalItem && (
        <PizzaHalfModal
          pizza={pizzaModalItem}
          otherPizzas={menu.find((c) => c.id === "pizzas")?.items || []}
          onAddFull={(pizza, notes) => {
            addToCart(pizza, null, notes);
            setPizzaModalItem(null);
          }}
          onAddHalf={(pizza1, pizza2, notes) => {
            addToCart(pizza1, null, notes, pizza2);
            setPizzaModalItem(null);
          }}
          onClose={() => setPizzaModalItem(null)}
        />
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

export default function EmployeeOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#fab76b" }}>
        <div className="text-white">Cargando...</div>
      </div>
    }>
      <EmployeeOrderContent />
    </Suspense>
  );
}
