"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";
import type { MenuCategory, MenuItem, MenuItemVariant, CartItem } from "@/types/menu";
import { formatPrice } from "@/lib/utils";
import ImageModal from "@/components/image-modal";

const CALL_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3";

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
      <div className="w-full max-w-lg bg-card rounded-t-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{item.name}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-border/50 text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {item.description && (
          <p className="text-sm text-muted">{item.description}</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">Elegí una opción:</p>
          {item.variants.filter((v) => v.available).map((variant) => (
            <button
              key={variant.id}
              onClick={() => setSelected(variant)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                selected?.id === variant.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-border/80"
              }`}
            >
              <span className="text-white font-medium">{variant.name}</span>
              <span className="text-white font-semibold">{formatPrice(variant.price)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function MenuItemComponent({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem, variant: MenuItemVariant | null) => void;
}) {
  const [showVariants, setShowVariants] = useState(false);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const hasVariants = item.variants.length > 0;
  const availableVariants = item.variants.filter((v) => v.available);
  const isAvailable = item.available && (hasVariants ? availableVariants.length > 0 : item.price !== null);

  const handleAdd = () => {
    if (!isAvailable) return;
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
        className={`flex items-center gap-4 p-4 rounded-xl bg-card border border-border transition-colors ${
          isAvailable ? "hover:border-border/80 cursor-pointer" : "opacity-50"
        }`}
        onClick={handleAdd}
      >
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-muted truncate mt-0.5">{item.description}</p>
          )}
          <div className="mt-2">
            {hasVariants ? (
              <div className="flex flex-wrap gap-1">
                {availableVariants.slice(0, 3).map((v) => (
                  <span key={v.id} className="text-xs bg-border/50 text-muted px-2 py-0.5 rounded-full">
                    {v.name}: {formatPrice(v.price)}
                  </span>
                ))}
                {availableVariants.length > 3 && (
                  <span className="text-xs text-muted">+{availableVariants.length - 3}</span>
                )}
              </div>
            ) : (
              <span className="text-white font-semibold">{formatPrice(item.price!)}</span>
            )}
          </div>
        </div>

        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 rounded-lg object-cover shrink-0 border border-border/50 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setModalImage({ src: item.image_url!, alt: item.name });
            }}
          />
        )}

        {isAvailable && (
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white text-xl font-bold">
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

export default function MenuPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { subscribeToMenuUpdates, createCall } = useDatabase();
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState<number>(0);
  const [showTableModal, setShowTableModal] = useState(false);
  const [newTableInput, setNewTableInput] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callMessage, setCallMessage] = useState("");
  const [calling, setCalling] = useState(false);
  const [showBarInfo, setShowBarInfo] = useState(false);
  const callSoundRef = useRef<HTMLAudioElement | null>(null);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const loadMenu = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setCustomerName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente");
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

      const userType = profile?.user_type || "regular";
      localStorage.setItem("user_type", userType);

      if (userType === "employee") {
        router.push("/comanda");
        return;
      }

      if (userType === "admin") {
        router.push("/tracking");
        return;
      }

      const savedTable = localStorage.getItem("table_number");
      if (savedTable) {
        setTableNumber(parseInt(savedTable, 10));
      }

      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
      setCartLoaded(true);

      const storedOrderId = localStorage.getItem("last_order_id");
      if (storedOrderId) {
        setLastOrderId(storedOrderId);
        localStorage.removeItem("last_order_id");
      } else {
        const { data: lastOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", user.id)
          .neq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastOrder) {
          setLastOrderId(lastOrder.id);
        }
      }

      const response = await fetch("/api/menu");
      const data = await response.json();
      setMenu(data);
      if (data.length > 0) {
        setActiveCategory(data[0].id);
      }
      setLoading(false);
    };

    loadMenu();

    const interval = setInterval(async () => {
      const response = await fetch(`/api/menu?t=${Date.now()}`);
      const data = await response.json();
      setMenu(data);
    }, 10000);

    return () => clearInterval(interval);
  }, [router, supabase]);

  useEffect(() => {
    const unsubscribe = subscribeToMenuUpdates(async () => {
      const response = await fetch(`/api/menu?t=${Date.now()}`);
      const data = await response.json();
      setMenu(data);
    });
    return unsubscribe;
  }, [subscribeToMenuUpdates]);

  useEffect(() => {
    if (cartLoaded) {
      localStorage.setItem("cart", JSON.stringify(cart));
    }
  }, [cart, cartLoaded]);

  const addToCart = (item: MenuItem, variant: MenuItemVariant | null) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.product.id === item.id && ci.variant?.id === variant?.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }

      return [...prev, { product: item, variant, quantity: 1 }];
    });
  };

  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0);
  const subtotal = cart.reduce(
    (sum, ci) => sum + (ci.variant?.price || ci.product.price || 0) * ci.quantity,
    0
  );

  const handleTableChange = () => {
    const num = parseInt(newTableInput, 10);
    if (num >= 1 && num <= 100) {
      setTableNumber(num);
      localStorage.setItem("table_number", String(num));
      setShowTableModal(false);
      setNewTableInput("");
    }
  };

  const handleCallMozo = async () => {
    if (!supabase || !userId || !tableNumber) return;
    setCalling(true);
    try {
      await createCall(userId, customerName, tableNumber, callMessage.trim() || null);
      const audio = new Audio(CALL_SOUND_URL);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      setShowCallModal(false);
      setCallMessage("");
    } catch (err) {
      console.error("Failed to create call:", err);
    }
    setCalling(false);
  };

  const getItemQuantity = (productId: string, variantId?: string) => {
    return cart
      .filter(
        (ci) =>
          ci.product.id === productId &&
          (variantId ? ci.variant?.id === variantId : true)
      )
      .reduce((sum, ci) => sum + ci.quantity, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando menú...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <h1
              className="text-xl font-bold text-white cursor-pointer active:opacity-70"
              onClick={() => setShowBarInfo(true)}
            >
              Pinta Tacos
            </h1>
            <button
              onClick={async () => {
                if (supabase) await supabase.auth.signOut();
                localStorage.clear();
                router.push("/login");
              }}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              Salir
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => {
                setNewTableInput(String(tableNumber));
                setShowTableModal(true);
              }}
              className="text-sm text-muted hover:text-white transition-colors flex items-center gap-1"
            >
              <span>Mesa {tableNumber || "?"}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <span className="text-sm text-white">{customerName}</span>
            <button
              onClick={() => setShowCallModal(true)}
              className="text-sm font-medium px-3 py-1 rounded-full bg-primary text-white hover:bg-primary-hover transition-colors ml-auto"
            >
              Llamar mozo
            </button>
            {lastOrderId && (
              <button
                onClick={() => router.push("/orders")}
                className="text-sm text-primary hover:text-primary-hover transition-colors ml-auto"
              >
                Ver mi pedido
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
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
                  ? "bg-primary text-white"
                  : "bg-card text-muted border border-border hover:border-border/80"
              }`}
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
                      <MenuItemComponent item={item} onAdd={addToCart} />
                      {qty > 0 && (
                        <div className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full">
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
            onClick={() => router.push("/confirm")}
            className="w-full max-w-lg mx-auto flex items-center justify-between bg-primary hover:bg-primary-hover text-white font-semibold py-4 px-6 rounded-full transition-colors shadow-lg"
          >
            <span>
              {totalItems} {totalItems === 1 ? "producto" : "productos"}
            </span>
            <span className="text-lg">{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">Cambiar mesa</h3>
            <input
              type="number"
              value={newTableInput}
              onChange={(e) => setNewTableInput(e.target.value)}
              placeholder="Número de mesa"
              min="1"
              max="100"
              className="w-full text-center text-3xl font-bold bg-background border border-border rounded-xl py-4 px-4 text-white placeholder-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTableChange();
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTableModal(false);
                  setNewTableInput("");
                }}
                className="flex-1 bg-border/50 hover:bg-border text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleTableChange}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50">
          <div className="w-full max-w-lg bg-background rounded-t-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Llamar al mozo</h3>
            <p className="text-sm text-muted">
              Mesa {tableNumber || "?"} · {customerName}
            </p>
            <textarea
              value={callMessage}
              onChange={(e) => setCallMessage(e.target.value)}
              placeholder="Mensaje opcional (ej: necesito ayuda con el pedido)"
              className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2 text-white placeholder:text-muted focus:outline-none focus:border-primary resize-none h-20"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCallModal(false);
                  setCallMessage("");
                }}
                className="flex-1 bg-border/50 hover:bg-border text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCallMozo}
                disabled={calling}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {calling ? "Llamando..." : "Llamar al mozo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bar info modal */}
      {showBarInfo && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90"
          onClick={() => setShowBarInfo(false)}
        >
          <button
            onClick={() => setShowBarInfo(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center z-[91]"
          >
            ✕
          </button>
          <div className="text-center px-8 max-w-md">
            <div
              className="w-48 h-48 mx-auto rounded-full mb-6 overflow-hidden border-4 border-primary/50"
              style={{ filter: "blur(0.5px)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/pinta-tacos-logo.png"
                alt="Pinta Tacos"
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Pinta Tacos</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Hola, soy Sergio Luna y este es Pinta Tacos.
              
              Nacimos con una idea simple: compartir el sabor, la alegría y la cultura de México con nuestra gente. Hoy queremos dar un paso más y transformar Pinta Tacos en mucho más que un bar: queremos convertirlo en un bodegón mexicano, un lugar para venir a comer rico, descubrir sabores, compartir una mesa y pasarla bien.

              Nuestra propuesta combina nuestra pasión por la comida mexicana con algo que nos identifica profundamente: Tucumán. Queremos que cada detalle tenga personalidad, desde la decoración y la música mexicana hasta los aromas de nuestra cocina llegando a la mesa.
              
              Estamos trabajando para mejorar nuestra carta y darle todavía más protagonismo a la comida, creando platos que tengas ganas de probar, compartir y volver a pedir. Y, por supuesto, acompañarlos con buenos tragos y una selección de tequilas que estén a la altura.
              
              Queremos que cuando entres sientas curiosidad, que algo te sorprenda y, sobre todo, que te vayas feliz y con ganas de volver.
              
              Y queremos ser parte de algo más grande: una comunidad de lugares con identidad propia, donde cada salida sea una oportunidad para descubrir algo nuevo.

              Bienvenido a Pinta Tacos. 🌮🇲🇽
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
