"use client";

import { useAuth } from './useAuth';
import { getSectorVocabulary } from '@/lib/sector-language';

export function useSectorVocabulary() {
  const { user } = useAuth();
  return getSectorVocabulary(user?.org_sector ?? 'GENERIC');
}
