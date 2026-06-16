"use client";

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const { user, setUser } = useAuthStore();

  const { data, isError, isPending } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    } else if (isError) {
      setUser(null);
    }
  }, [data, isError, setUser]);

  return { user, isLoading: isPending };
}
