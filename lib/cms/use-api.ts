"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/cms/api";

export function useApi<T>(paths: string[], revision = 0, enabled = true) {
  const result = useQuery({
    enabled,
    queryKey: ["cms", paths, revision],
    queryFn: ({ signal }) =>
      Promise.all(paths.map((path) => api(path, { signal }))) as Promise<T>,
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 5 * 60_000,
  });
  return {
    data: result.data ?? null,
    error: result.error instanceof Error ? result.error.message : null,
    loading: result.isPending,
  };
}
