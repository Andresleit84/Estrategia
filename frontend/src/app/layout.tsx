import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { WebVitals } from "@/components/WebVitals";
import { NextIntlClientProvider } from "@/components/providers/IntlProvider";
import { cookies } from "next/headers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OKR System",
  description: "Gestión estratégica y táctica de OKRs",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const SUPPORTED = ["es", "en"] as const;
type Locale = (typeof SUPPORTED)[number];

const loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import("../../messages/es.json"),
  en: () => import("../../messages/en.json"),
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "es";
  const locale: Locale = SUPPORTED.includes(raw as Locale) ? (raw as Locale) : "es";
  const messages = (await loaders[locale]()).default;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full overflow-hidden antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <WebVitals />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
