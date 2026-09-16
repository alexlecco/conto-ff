"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/supabase/use-client";
import { useDatabase } from "@/lib/supabase/use-database";
import AdminNav from "@/components/admin-nav";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  user_type: string;
  role: string | null;
}

function getNickname(email: string): string {
  return email.split("@")[0] || email;
}

const ROLE_OPTIONS = [
  { value: "cocinero", label: "Cocinero" },
  { value: "mesero", label: "Mesero" },
  { value: "bartender", label: "Bartender" },
  { value: "dj", label: "DJ" },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const { broadcastProfileUpdate, subscribeToProfileUpdates } = useDatabase();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;
    const { data: allUsers, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_type, role")
      .order("email");
    if (!error && allUsers) {
      setUsers(allUsers);
    }
  }, [supabase]);

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

      await loadUsers();
      setLoading(false);
    };
    init();
  }, [router, supabase, loadUsers]);

  useEffect(() => {
    const unsubscribe = subscribeToProfileUpdates(() => {
      loadUsers();
    });
    return unsubscribe;
  }, [subscribeToProfileUpdates, loadUsers]);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilteredUsers(users);
    } else {
      setFilteredUsers(
        users.filter(
          (u) =>
            getNickname(u.email).toLowerCase().includes(q) ||
            (u.full_name && u.full_name.toLowerCase().includes(q)) ||
            u.email.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, users]);

  const handleTypeChange = async (
    userId: string,
    newType: "regular" | "employee"
  ) => {
    if (!supabase) return;
    setUpdatingUserId(userId);
    try {
      const update: Record<string, unknown> = { user_type: newType };
      if (newType === "regular") update.role = null;
      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, user_type: newType, role: newType === "regular" ? null : u.role }
            : u
        )
      );
      broadcastProfileUpdate();
    } catch (err) {
      console.error("Failed to update type:", err);
    }
    setUpdatingUserId(null);
  };

  const handleRoleChange = async (userId: string, newRole: string | null) => {
    if (!supabase) return;
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      broadcastProfileUpdate();
    } catch (err) {
      console.error("Failed to update role:", err);
    }
    setUpdatingUserId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "#d9d9d9" }}>
      <div
        className="sticky top-0 z-40 border-b border-gray-300 px-4 py-4"
        style={{ backgroundColor: "#d9d9d9" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <AdminNav />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
              <p className="text-sm text-gray-600">
                {filteredUsers.length} usuario{filteredUsers.length !== 1 && "s"}
              </p>
            </div>
          </div>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nickname, nombre o email..."
          className="w-full text-sm bg-black border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-900"
        />
      </div>

      <div className="px-4 py-4 space-y-3">
        {filteredUsers.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No se encontraron usuarios
          </div>
        )}

        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="rounded-xl bg-white border border-gray-300 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      user.user_type === "admin"
                        ? "bg-gray-600"
                        : user.user_type === "employee"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                  />
                  <span className="font-medium text-gray-900 truncate">
                    {getNickname(user.email)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                {user.full_name && (
                  <p className="text-xs text-gray-400">{user.full_name}</p>
                )}
              </div>

              {updatingUserId === user.id && (
                <span className="text-xs text-gray-400">Guardando...</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-gray-500">Tipo:</span>
              <div className="flex gap-1">
                {(["regular", "employee"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(user.id, type)}
                    disabled={user.user_type === type || updatingUserId === user.id}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      user.user_type === type
                        ? type === "employee"
                          ? "bg-amber-500 text-white"
                          : "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    } disabled:opacity-50`}
                  >
                    {type === "regular" ? "Regular" : "Empleado"}
                  </button>
                ))}
              </div>
            </div>

            {user.user_type === "employee" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Rol:</span>
                <div className="flex flex-wrap gap-1">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      onClick={() =>
                        handleRoleChange(
                          user.id,
                          user.role === role.value ? null : role.value
                        )
                      }
                      disabled={updatingUserId === user.id}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        user.role === role.value
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
