"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/menu");
      }
    };
    checkUser();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Conto FF</h1>
          <p className="text-muted text-lg">Pinta Tacos</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full max-w-xs mx-auto bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-6 rounded-full transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
