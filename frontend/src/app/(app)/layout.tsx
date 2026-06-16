import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { LocaleSync } from '@/components/providers/LocaleSync';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasToken = cookieStore.has('access_token');

  if (!hasToken) {
    redirect('/auth/login');
  }

  return (
    <AppShell>
      <LocaleSync />
      {children}
    </AppShell>
  );
}
