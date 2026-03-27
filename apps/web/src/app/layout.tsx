import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { SidebarLayout } from "@/components/SidebarLayout";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PlanFlow — Media Plan Calculator",
  description: "B2B SaaS media plan calculator for Jasmin Media / DC Group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full bg-[#F9F9F9]">
        <AuthProvider>
          <Sidebar />
          <SidebarLayout>
            <ProtectedRoute>{children}</ProtectedRoute>
          </SidebarLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
