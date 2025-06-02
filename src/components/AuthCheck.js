"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCheck({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const checkUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Initial session check:", session);

      setUser(session?.user);

      const isAuthPage = pathname.startsWith("/auth/") || pathname === "/";

      if (!session && !isAuthPage) {
        router.push("/auth/login");
      } else if (
        session &&
        (pathname.startsWith("/auth/") || pathname === "/")
      ) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event, session);

      if (event === "SIGNED_IN") {
        setUser(session?.user);
        setTimeout(() => {
          if (pathname.startsWith("/auth/")) {
            router.push("/dashboard");
          }
        }, 100);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        router.push("/auth/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUser, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (pathname.startsWith("/auth/") || pathname === "/") {
    return children;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Redirecting to login...</div>
      </div>
    );
  }

  return children;
}
