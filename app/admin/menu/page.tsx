"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";

interface Variant {
  id: string;
  name: string;
  price: number;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  available: boolean;
  variants: Variant[];
}

interface Category {
  id: string;
  name: string;
  items: Item[];
}

export default function AdminMenuPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { updateMenuItem, fetchMenu } = useDatabase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    const data = await fetchMenu();
    setCategories(data);
    if (data.length > 0 && !expandedCategory) {
      setExpandedCategory(data[0].id);
    }
    setLoading(false);
  }, [fetchMenu, expandedCategory]);

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
      loadMenu();
    };
    init();
  }, [router, supabase, loadMenu]);

  const handleUpdateField = async (
    categoryId: string,
    itemId: string,
    field: string,
    value: string | number | boolean | null,
    variantId?: string
  ) => {
    const key = `${categoryId}-${itemId}-${variantId || "main"}`;
    setSaving(key);

    try {
      const newCategories = await updateMenuItem(
        categoryId,
        itemId,
        field,
        value,
        variantId
      );
      setCategories(newCategories);
    } catch {
      // Silently fail
    }

    setSaving(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando menú...</div>
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
            <h1 className="text-xl font-bold text-gray-900">Editar Menú</h1>
            <p className="text-sm text-gray-600">
              {categories.reduce((sum, c) => sum + c.items.length, 0)} items
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
              onClick={() => router.push("/admin/history")}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-300"
            >
              Historial
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setExpandedCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                expandedCategory === cat.id
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-300"
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {categories
          .filter((cat) => !expandedCategory || cat.id === expandedCategory)
          .map((cat) => (
            <div key={cat.id} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                {cat.name}
              </h2>
              <div className="flex flex-col" style={{ gap: "12px" }}>
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white border border-gray-300 overflow-hidden"
                  >
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newCategories = categories.map((c) =>
                              c.id === cat.id
                                ? {
                                    ...c,
                                    items: c.items.map((i) =>
                                      i.id === item.id
                                        ? { ...i, name: e.target.value }
                                        : i
                                    ),
                                  }
                                : c
                            );
                            setCategories(newCategories);
                          }}
                          onBlur={() =>
                            handleUpdateField(cat.id, item.id, "name", item.name)
                          }
                          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-gray-200 focus:border-gray-900 focus:outline-none"
                        />
                        <button
                          onClick={() =>
                            handleUpdateField(
                              cat.id,
                              item.id,
                              "available",
                              !item.available
                            )
                          }
                          className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${
                            item.available ? "bg-green-500" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              item.available ? "translate-x-3.5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {item.description !== null && (
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const newCategories = categories.map((c) =>
                              c.id === cat.id
                                ? {
                                    ...c,
                                    items: c.items.map((i) =>
                                      i.id === item.id
                                        ? { ...i, description: e.target.value }
                                        : i
                                    ),
                                  }
                                : c
                            );
                            setCategories(newCategories);
                          }}
                          onBlur={() =>
                            handleUpdateField(
                              cat.id,
                              item.id,
                              "description",
                              item.description
                            )
                          }
                          className="w-full text-xs text-gray-500 bg-transparent border-b border-gray-100 focus:border-gray-400 focus:outline-none"
                        />
                      )}

                      {item.variants.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          {item.variants.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center gap-2"
                            >
                              <span className="text-xs text-gray-500 flex-1">
                                {v.name}
                              </span>
                              <input
                                type="number"
                                value={v.price}
                                onChange={(e) => {
                                  const newCategories = categories.map((c) =>
                                    c.id === cat.id
                                      ? {
                                          ...c,
                                          items: c.items.map((i) =>
                                            i.id === item.id
                                              ? {
                                                  ...i,
                                                  variants: i.variants.map(
                                                    (vr) =>
                                                      vr.id === v.id
                                                        ? {
                                                            ...vr,
                                                            price: Number(
                                                              e.target.value
                                                            ),
                                                          }
                                                        : vr
                                                  ),
                                                }
                                              : i
                                          ),
                                        }
                                      : c
                                  );
                                  setCategories(newCategories);
                                }}
                                onBlur={() =>
                                  handleUpdateField(
                                    cat.id,
                                    item.id,
                                    "price",
                                    v.price,
                                    v.id
                                  )
                                }
                                className="w-24 text-xs text-right text-gray-900 bg-gray-50 rounded px-2 py-1 border border-gray-200 focus:border-gray-900 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      ) : item.price !== null ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-gray-500">Precio</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const newCategories = categories.map((c) =>
                                c.id === cat.id
                                  ? {
                                      ...c,
                                      items: c.items.map((i) =>
                                        i.id === item.id
                                          ? {
                                              ...i,
                                              price: Number(e.target.value),
                                            }
                                          : i
                                      ),
                                    }
                                  : c
                              );
                              setCategories(newCategories);
                            }}
                            onBlur={() =>
                              handleUpdateField(cat.id, item.id, "price", item.price)
                            }
                            className="w-24 text-xs text-right text-gray-900 bg-gray-50 rounded px-2 py-1 border border-gray-200 focus:border-gray-900 focus:outline-none"
                          />
                        </div>
                      ) : null}

                      {saving === `${cat.id}-${item.id}-main` && (
                        <div className="text-xs text-gray-400">Guardando...</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
