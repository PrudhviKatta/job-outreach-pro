import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Layout/Header";
import MobileNav from "@/components/Layout/MobileNav";
import { Toaster } from "react-hot-toast";
import AuthCheck from "@/components/AuthCheck";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Job Outreach Pro",
  description: "Automate your job search outreach",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthCheck>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="pb-20 lg:pb-0">{children}</main>
            <MobileNav />
          </div>
        </AuthCheck>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
