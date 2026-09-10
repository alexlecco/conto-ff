"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type PendingChange = {
  categoryId: string;
  itemId: string;
  field: string;
  value: string | number | boolean | null;
  variantId?: string;
};

function SortableCategory({
  cat,
  isActive,
  onClick,
}: {
  cat: Category;
  isActive: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-grab active:cursor-grabbing touch-none select-none ${
        isActive
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-600 border border-gray-300"
      } ${isDragging ? "shadow-lg ring-2 ring-gray-400" : ""}`}
    >
      {cat.name} ({cat.items.length})
    </button>
  );
}

export default function AdminMenuPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const {
    bulkUpdateMenu,
    createMenuItem,
    deleteMenuItem,
    reorderMenuItems,
    reorderCategories,
    fetchMenu,
    broadcastMenuUpdate,
  } = useDatabase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  const getPendingValue = (
    categoryId: string,
    itemId: string,
    field: string,
    variantId?: string
  ) => {
    const change = pendingChanges.find(
      (p) =>
        p.categoryId === categoryId &&
        p.itemId === itemId &&
        p.field === field &&
        p.variantId === variantId
    );
    return change?.value;
  };

  const getLocalValue = <T,>(
    categoryId: string,
    itemId: string,
    field: string,
    fallback: T,
    variantId?: string
  ): T => {
    const pending = getPendingValue(categoryId, itemId, field, variantId);
    if (pending !== undefined) return pending as T;
    return fallback;
  };

  const addPendingChange = (change: PendingChange) => {
    setPendingChanges((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.categoryId === change.categoryId &&
          p.itemId === change.itemId &&
          p.field === change.field &&
          p.variantId === change.variantId
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = change;
        return updated;
      }
      return [...prev, change];
    });
  };

  const handleToggleAvailable = (
    categoryId: string,
    itemId: string,
    currentAvailable: boolean
  ) => {
    const newAvailable = !currentAvailable;
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === itemId ? { ...i, available: newAvailable } : i
              ),
            }
          : c
      )
    );
    addPendingChange({
      categoryId,
      itemId,
      field: "available",
      value: newAvailable,
    });
  };

  const handleBulkUpdate = async () => {
    if (pendingChanges.length === 0) return;
    setSaving(true);
    try {
      const updatedCategories = await bulkUpdateMenu(pendingChanges);
      setCategories(updatedCategories);
      setPendingChanges([]);
      broadcastMenuUpdate();
    } catch (err) {
      console.error("Failed to save:", err);
    }
    setSaving(false);
  };

  const handleDeleteItem = async (categoryId: string, itemId: string) => {
    try {
      const newCategories = await deleteMenuItem(categoryId, itemId);
      setCategories(newCategories);
      broadcastMenuUpdate();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleCreateItem = async (categoryId: string) => {
    if (!newItemName.trim()) return;
    try {
      const price = newItemPrice ? Number(newItemPrice) : undefined;
      const newCategories = await createMenuItem(
        categoryId,
        newItemName.trim(),
        undefined,
        price
      );
      setCategories(newCategories);
      setNewItemName("");
      setNewItemPrice("");
      setShowAddItem(null);
      broadcastMenuUpdate();
    } catch (err) {
      console.error("Failed to create:", err);
    }
  };

  const handleMoveItem = async (
    categoryId: string,
    itemId: string,
    direction: "up" | "down"
  ) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const idx = cat.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === cat.items.length - 1) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    const newItems = [...cat.items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];

    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, items: newItems } : c))
    );

    try {
      await reorderMenuItems(
        categoryId,
        newItems.map((i) => i.id)
      );
      broadcastMenuUpdate();
    } catch (err) {
      console.error("Failed to reorder:", err);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, items: cat.items } : c
        )
      );
    }
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    try {
      await reorderCategories(newCategories.map((c) => c.id));
      broadcastMenuUpdate();
    } catch (err) {
      console.error("Failed to reorder categories:", err);
      setCategories(categories);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando menú...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#d9d9d9" }}>
      <div
        className="sticky top-0 z-40 border-b border-gray-300 px-4 py-4"
        style={{ backgroundColor: "#d9d9d9" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Editar Menú</h1>
            <p className="text-sm text-gray-600">
              {categories.reduce((sum, c) => sum + c.items.length, 0)} items
              {pendingChanges.length > 0 && (
                <span className="ml-2 text-orange-600 font-medium">
                  ({pendingChanges.length} sin guardar)
                </span>
              )}
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <SortableCategory
                  key={cat.id}
                  cat={cat}
                  isActive={expandedCategory === cat.id}
                  onClick={() => setExpandedCategory(cat.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="px-4 py-4">
        {categories
          .filter((cat) => !expandedCategory || cat.id === expandedCategory)
          .map((cat) => (
            <div key={cat.id} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {cat.name}
                </h2>
                <button
                  onClick={() =>
                    setShowAddItem(showAddItem === cat.id ? null : cat.id)
                  }
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  + Agregar
                </button>
              </div>

              {showAddItem === cat.id && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Precio (opcional)"
                    className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddItem(null);
                        setNewItemName("");
                        setNewItemPrice("");
                      }}
                      className="flex-1 text-xs py-2 rounded-lg bg-gray-200 text-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleCreateItem(cat.id)}
                      disabled={!newItemName.trim()}
                      className="flex-1 text-xs py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                    >
                      Crear
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col" style={{ gap: "8px" }}>
                {cat.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white border border-gray-300 overflow-hidden"
                  >
                    <div className="px-3 py-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveItem(cat.id, item.id, "up")}
                            disabled={idx === 0}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() =>
                              handleMoveItem(cat.id, item.id, "down")
                            }
                            disabled={idx === cat.items.length - 1}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                          >
                            ▼
                          </button>
                        </div>

                        <input
                          type="text"
                          value={getLocalValue(cat.id, item.id, "name", item.name)}
                          onChange={(e) => {
                            setCategories((prev) =>
                              prev.map((c) =>
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
                              )
                            );
                            addPendingChange({
                              categoryId: cat.id,
                              itemId: item.id,
                              field: "name",
                              value: e.target.value,
                            });
                          }}
                          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-b border-gray-200 focus:border-gray-900 focus:outline-none"
                        />

                        <button
                          onClick={() =>
                            handleToggleAvailable(
                              cat.id,
                              item.id,
                              getLocalValue(
                                cat.id,
                                item.id,
                                "available",
                                item.available
                              )
                            )
                          }
                          className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${
                            getLocalValue(
                              cat.id,
                              item.id,
                              "available",
                              item.available
                            )
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              getLocalValue(
                                cat.id,
                                item.id,
                                "available",
                                item.available
                              )
                                ? "translate-x-3.5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => handleDeleteItem(cat.id, item.id)}
                          className="text-gray-400 hover:text-red-500 text-sm px-1"
                        >
                          ✕
                        </button>
                      </div>

                      {item.variants.length > 0 ? (
                        <div className="space-y-1 pl-6">
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
                                value={getLocalValue(
                                  cat.id,
                                  item.id,
                                  "price",
                                  v.price,
                                  v.id
                                )}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setCategories((prev) =>
                                    prev.map((c) =>
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
                                                              price: val,
                                                            }
                                                          : vr
                                                    ),
                                                  }
                                                : i
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                  addPendingChange({
                                    categoryId: cat.id,
                                    itemId: item.id,
                                    field: "price",
                                    value: val,
                                    variantId: v.id,
                                  });
                                }}
                                className="w-24 text-xs text-right text-gray-900 bg-gray-50 rounded px-2 py-1 border border-gray-200 focus:border-gray-900 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      ) : item.price !== null ? (
                        <div className="flex items-center justify-between pl-6">
                          <span className="text-xs text-gray-500">Precio</span>
                          <input
                            type="number"
                            value={getLocalValue(
                              cat.id,
                              item.id,
                              "price",
                              item.price
                            )}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCategories((prev) =>
                                prev.map((c) =>
                                  c.id === cat.id
                                    ? {
                                        ...c,
                                        items: c.items.map((i) =>
                                          i.id === item.id
                                            ? { ...i, price: val }
                                            : i
                                        ),
                                      }
                                    : c
                                )
                              );
                              addPendingChange({
                                categoryId: cat.id,
                                itemId: item.id,
                                field: "price",
                                value: val,
                              });
                            }}
                            className="w-24 text-xs text-right text-gray-900 bg-gray-50 rounded px-2 py-1 border border-gray-200 focus:border-gray-900 focus:outline-none"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {pendingChanges.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-300 shadow-lg">
          <button
            onClick={handleBulkUpdate}
            disabled={saving}
            className="w-full max-w-lg mx-auto bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-full transition-colors disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : `Actualizar ${pendingChanges.length} cambio${
                  pendingChanges.length > 1 ? "s" : ""
                }`}
          </button>
        </div>
      )}
    </div>
  );
}
