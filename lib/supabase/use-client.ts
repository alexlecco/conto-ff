"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}

export function useSupabase(): SupabaseClient | null {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    const client = getClient();
    // Update state to trigger re-render with the client
    const timer = setTimeout(() => setSupabase(client), 0);
    return () => clearTimeout(timer);
  }, []);

  return supabase;
}
