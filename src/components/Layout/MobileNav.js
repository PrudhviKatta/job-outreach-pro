"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Send, Users, FileText, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MobileNav() {
  const pathname = usePathname();

  const navigation = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "Email", href: "/email", icon: Send },
    { name: "Templates", href: "/templates", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Logout", href: "#", icon: LogOut, action: "logout" },
  ];

  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex justify-around">
        {navigation.map((item) =>
          item.action === "logout" ? (
            <button
              key={item.name}
              onClick={handleLogout}
              className="flex flex-col items-center py-2 px-3 text-gray-600"
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </button>
          ) : (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 ${
                pathname === item.href ? "text-indigo-600" : "text-gray-600"
              }`}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
