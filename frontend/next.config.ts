import type { NextConfig } from "next";
import BundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = BundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Permite acceso externo al dev server sin reiniciar el frontend.
// Los wildcards cubren cualquier subdominio ngrok (free y paid).
// NGROK_HOSTNAME sigue siendo soportado como override manual.
const allowedDevOrigins: string[] = [
  "*.ngrok-free.app",   // plan gratuito
  "*.ngrok.io",         // planes pagos
  "*.ngrok.app",        // dominio alternativo ngrok
];
if (process.env.NGROK_HOSTNAME) {
  allowedDevOrigins.push(process.env.NGROK_HOSTNAME);
}

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "recharts",
      "@nivo/radar",
      "@tanstack/react-query",
    ],
  },
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3021/api/:path*",
      },
    ];
  },
};

const configWithAnalyzer = withBundleAnalyzer(nextConfig);
const configWithIntl = withNextIntl(configWithAnalyzer);

// Sentry wraps only when DSN is configured — no-op otherwise
const hasSentry = !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);

export default hasSentry
  ? withSentryConfig(configWithIntl, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : configWithIntl;
