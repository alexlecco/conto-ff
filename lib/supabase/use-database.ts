"use client";

import { useCallback, useRef, useEffect } from "react";
import { useSupabase } from "@/lib/supabase/use-client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export interface DBOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DBOrder {
  id: string;
  user_id: string;
  customer_name: string;
  table_number: number;
  total: number;
  status: string;
  created_at: string;
  items?: DBOrderItem[];
}

export type OrderEvent =
  | { type: "INSERT"; order: DBOrder }
  | { type: "UPDATE"; order: DBOrder }
  | { type: "DELETE"; orderId: string };

async function fetchItemsForOrders(
  supabase: SupabaseClient | null,
  orders: DBOrder[]
): Promise<DBOrder[]> {
  if (!supabase) return orders;
  return Promise.all(
    orders.map(async (order) => {
      if (order.items) return order;
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);
      return { ...order, items: items || [] };
    })
  );
}

export function useDatabase() {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ─── Orders ────────────────────────────────────────────────────

  const createOrder = useCallback(
    async (
      userId: string,
      customerName: string,
      tableNumber: number,
      items: {
        product_id: string;
        product_name: string;
        variant_id: string | null;
        variant_name: string | null;
        quantity: number;
        unit_price: number;
        subtotal: number;
      }[],
      total: number
    ) => {
      if (!supabase) throw new Error("Supabase not ready");

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          customer_name: customerName,
          table_number: tableNumber,
          total,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order.id as string;
    },
    [supabase]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: string) => {
      if (!supabase) throw new Error("Supabase not ready");

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
    },
    [supabase]
  );

  const fetchActiveOrders = useCallback(
    async (userId?: string) => {
      if (!supabase) return [];

      let query = supabase
        .from("orders")
        .select("*")
        .neq("status", "delivered")
        .order("created_at", { ascending: userId ? false : true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data } = await query;
      if (!data) return [];
      return fetchItemsForOrders(supabase, data);
    },
    [supabase]
  );

  const fetchAllOrders = useCallback(async () => {
    if (!supabase) return [];

    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return [];
    return fetchItemsForOrders(supabase, data);
  }, [supabase]);

  const fetchOrderHistory = useCallback(
    async (userId?: string) => {
      if (!supabase) return [];

      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data } = await query;
      if (!data) return [];
      return fetchItemsForOrders(supabase, data);
    },
    [supabase]
  );

  // ─── Real-time subscriptions ───────────────────────────────────

  const subscribeToOrders = useCallback(
    (onEvent: (event: OrderEvent) => void) => {
      if (!supabase) return () => {};

      const channel = supabase
        .channel("db-orders-global")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            onEvent({ type: "INSERT", order: payload.new as DBOrder });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            onEvent({ type: "UPDATE", order: payload.new as DBOrder });
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "orders" },
          (payload) => {
            onEvent({
              type: "DELETE",
              orderId: (payload.old as DBOrder).id,
            });
          }
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
        channelRef.current = null;
      };
    },
    [supabase]
  );

  const fetchOrderItems = useCallback(
    async (orderId: string): Promise<DBOrderItem[]> => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      return data || [];
    },
    [supabase]
  );

  // ─── Menu ──────────────────────────────────────────────────────

  const updateMenuItem = useCallback(
    async (
      categoryId: string,
      itemId: string,
      field: string,
      value: string | number | boolean | null,
      variantId?: string
    ) => {
      if (!supabase) throw new Error("Supabase not ready");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body: Record<string, string | number | boolean | null> = {
        categoryId,
        itemId,
      };
      if (variantId) {
        body.variantId = variantId;
        if (field === "name") body.variantName = value;
        if (field === "price") body.variantPrice = Number(value);
      } else {
        body[field] = value;
      }

      const res = await fetch("/api/admin/menu", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to update menu item");
      const data = await res.json();
      return data.categories;
    },
    [supabase]
  );

  const fetchMenu = useCallback(async () => {
    const res = await fetch(`/api/menu?t=${Date.now()}`);
    if (!res.ok) throw new Error("Failed to fetch menu");
    return res.json();
  }, []);

  // ─── Cleanup on unmount ───────────────────────────────────────

  useEffect(() => {
    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase]);

  return {
    // Orders
    createOrder,
    updateOrderStatus,
    fetchActiveOrders,
    fetchAllOrders,
    fetchOrderHistory,
    fetchOrderItems,
    // Real-time
    subscribeToOrders,
    // Menu
    updateMenuItem,
    fetchMenu,
  };
}
