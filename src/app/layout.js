import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Layout/Header";
import MobileNav from "@/components/Layout/MobileNav";
import AuthCheck from "@/components/AuthCheck";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Job Outreach Pro",
  description: "Automated job search outreach platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Providers>
          <AuthCheck>
            <Header />
            <main className="container mx-auto px-4 py-8 pb-20 lg:pb-8">
              {children}
            </main>
            <MobileNav />
          </AuthCheck>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
