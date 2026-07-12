import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { AuthenticatedProviders } from "@/components/providers/authenticated-providers";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Property Siteplan ERP",
  description: "Sistem Denah Property Perumahan Berbasis Web",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head suppressHydrationWarning />
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <NextTopLoader 
          color="#4F6F52" 
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #4F6F52,0 0 5px #4F6F52"
        />
        <TooltipProvider>
          <AuthenticatedProviders>
            {children}
            <MobileBottomNav />
          </AuthenticatedProviders>
        </TooltipProvider>
        <Toaster
          theme="light"
          position="top-right"
          toastOptions={{ duration: 4000 }}
          visibleToasts={3}
          richColors
        />
      </body>
    </html>
  );
}
