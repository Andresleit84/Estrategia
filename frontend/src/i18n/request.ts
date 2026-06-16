import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['es', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const messageLoaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import('../../messages/es.json'),
  en: () => import('../../messages/en.json'),
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? 'es';
  const locale: Locale = SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : 'es';

  const messages = (await messageLoaders[locale]()).default;

  return { locale, messages };
});
