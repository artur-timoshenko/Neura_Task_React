import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, API_URL, PUBLIC_CLIENT_ID } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: { name: string; email: string | null; avatar_url?: string } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ name: string; email: string | null; avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);
  // Dedupe: getSession() and onAuthStateChange(INITIAL_SESSION / TOKEN_REFRESHED)
  // all fire for the same user — fetch role+profile once per user id.
  const fetchedForRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchUserData = async (userId: string, force = false) => {
    if (!force) {
      if (fetchedForRef.current === userId) return;
      if (inFlightRef.current) return inFlightRef.current;
    }
    fetchedForRef.current = userId;
    const run = (async () => {
      const [roleRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("name, email, avatar_url").eq("id", userId).maybeSingle(),
      ]);
      setRole(roleRes.data?.role ?? null);
      setProfile(profileRes.data ?? null);
      setRoleLoaded(true);
    })();
    inFlightRef.current = run;
    try {
      await run;
    } finally {
      inFlightRef.current = null;
    }
  };


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Keep the realtime socket authorized, otherwise it dies on token refresh.
        supabase.realtime.setAuth(session?.access_token ?? null);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          fetchedForRef.current = null;
          setRole(null);
          setProfile(null);
          setRoleLoaded(true);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      supabase.realtime.setAuth(session?.access_token ?? null);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setRoleLoaded(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUserData = async () => {
    if (user) await fetchUserData(user.id, true);
  };

  useEffect(() => {
    if (!user?.id) return;
    let lastSent = 0;
    const record = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSent < 300_000) return;
      lastSent = Date.now();
      try {
        const { data: { session: current } } = await supabase.auth.getSession();
        if (!current) return;
        await fetch(`${API_URL}/functions/v1/record-visit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${current.access_token}`, apikey: PUBLIC_CLIENT_ID },
        });
      } catch { /* Visit tracking must never interrupt the user's session. */ }
    };
    void record();
    const timer = window.setInterval(record, 300_000);
    document.addEventListener("visibilitychange", record);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", record); };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading: loading || (!!user && !roleLoaded), signOut, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
