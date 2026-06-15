import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { ApiResponse } from '../types';

export function useBrandConfig() {
  const { data } = useQuery({
    queryKey: ['public-brand-config'],
    queryFn: () =>
      api.get<ApiResponse<Record<string, string>>>('/public/settings').then((r) => r.data.data),
    staleTime: 1000 * 60 * 10, // 10 min cache
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const color = data['company.primaryColor'];
    if (color) {
      document.documentElement.style.setProperty('--sf-primary', color);
      // Also derive a darker ink color
      document.documentElement.style.setProperty('--sf-primary-ink', color);
    }
  }, [data]);

  return {
    logo: data?.['company.logo'] ?? null,
    primaryColor: data?.['company.primaryColor'] ?? null,
    companyName: data?.['company.name'] ?? null,
  };
}
