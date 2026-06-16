"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface SearchResult {
  id:       string;
  title:    string;
  subtitle: string;
  type_key: string;
  category: string;
  href:     string;
}

export function useGlobalSearch(q: string) {
  return useQuery<SearchResult[]>({
    queryKey: ["global-search", q],
    queryFn:  () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
    enabled:  q.trim().length >= 2,
    staleTime: 30_000,
  });
}
