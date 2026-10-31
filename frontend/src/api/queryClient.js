import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => (
        error.status >= 400 && error.status < 500 ? false : failureCount < 1
      ),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
