import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface OrderItemPayload {
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderPayload {
  table_number: number;
  items: OrderItemPayload[];
  total: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: OrderPayload = await request.json();

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "La orden está vacía" }, { status: 400 });
  }

  if (!body.table_number || body.table_number < 1 || body.table_number > 100) {
    return NextResponse.json({ error: "Número de mesa inválido" }, { status: 400 });
  }

  const calculatedTotal = body.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  if (calculatedTotal !== body.total) {
    return NextResponse.json({ error: "El total no coincide" }, { status: 400 });
  }

  const customerName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      customer_name: customerName,
      table_number: body.table_number,
      total: body.total,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError) {
    return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
  }

  const orderItems = body.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.product_name,
    variant_id: item.variant_id,
    variant_name: item.variant_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    return NextResponse.json({ error: "Error al guardar los items" }, { status: 500 });
  }

  return NextResponse.json({ success: true, order_id: order.id });
}
