"use client";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthCheck({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage =
    pathname?.startsWith("/auth/login") ||
    pathname?.startsWith("/auth/signup");
  const isPublicPage = pathname === "/";

  useEffect(() => {
    if (status === "loading") return;

    if (!session && !isAuthPage && !isPublicPage) {
      router.push("/auth/login");
    }

    if (session && isAuthPage) {
      router.push("/dashboard");
    }
  }, [session, status, isAuthPage, isPublicPage, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session && !isAuthPage && !isPublicPage) {
    return null;
  }

  return children;
}
