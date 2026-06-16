'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Web Vitals] ${metric.name}:`, Math.round(metric.value), metric.rating);
    }
    // In production, forward to analytics endpoint if configured
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ANALYTICS_URL) {
      try {
        navigator.sendBeacon(
          process.env.NEXT_PUBLIC_ANALYTICS_URL,
          JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, id: metric.id }),
        );
      } catch {
        // sendBeacon failures are non-fatal
      }
    }
  });
  return null;
}
