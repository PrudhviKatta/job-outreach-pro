"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCheck({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check initial session
    checkUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event, session);

      if (event === "SIGNED_IN") {
        setUser(session?.user);
        if (pathname.startsWith("/auth/")) {
          router.push("/dashboard");
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        router.push("/auth/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  async function checkUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Initial session check:", session);

      setUser(session?.user);

      const isAuthPage = pathname.startsWith("/auth/") || pathname === "/";

      if (!session && !isAuthPage) {
        router.push("/auth/login");
      } else if (session && pathname.startsWith("/auth/")) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Don't render auth wrapper on auth pages
  if (pathname.startsWith("/auth/") || pathname === "/") {
    return children;
  }

  // Only render protected content if user exists
  if (!user) {
    return null;
  }

  return children;
}
