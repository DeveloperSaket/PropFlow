import { api } from './client.js';

export const queryKeys = {
  properties: {
    all: ['properties'],
    lists: () => ['properties', 'list'],
    list: (params) => ['properties', 'list', params],
    detail: (id) => ['properties', 'detail', String(id)],
    mine: (userId) => ['properties', 'mine', String(userId)],
  },
  interests: {
    all: ['interests'],
    mine: (userId) => ['interests', 'mine', String(userId)],
    received: (userId) => ['interests', 'received', String(userId)],
  },
  appointments: {
    all: ['appointments'],
    mine: (userId, view) => ['appointments', 'mine', String(userId), view],
  },
  admin: {
    stats: ['admin', 'stats'],
    pendingListings: ['admin', 'pending-listings'],
    users: ['admin', 'users'],
    audit: ['admin', 'audit'],
    appointments: ['admin', 'appointments'],
  },
  kyc: (userId) => ['kyc', String(userId)],
};

export const propertyQueries = {
  list: async (params, { signal } = {}) => api.get(`/properties?${params}`, { signal }),
  detail: async (id, { signal } = {}) => {
    const response = await api.get(`/properties/${id}`, { signal });
    return response.data;
  },
  mine: async ({ signal } = {}) => {
    const response = await api.get('/properties?mine=1&limit=50', { signal });
    return response.data;
  },
};

export const interestQueries = {
  mine: async ({ signal } = {}) => {
    const response = await api.get('/interests/mine', { signal });
    return response.data;
  },
  received: async ({ signal } = {}) => {
    const response = await api.get('/interests/received', { signal });
    return response.data;
  },
};

export const appointmentQueries = {
  mine: async (view, { signal } = {}) => {
    const response = await api.get(`/appointments/mine?view=${view}`, { signal });
    return response.data;
  },
};

export const adminQueries = {
  stats: ({ signal } = {}) => api.get('/admin/stats', { signal }),
  pendingListings: async ({ signal } = {}) => {
    const response = await api.get('/admin/listings/pending', { signal });
    return response.data;
  },
  users: async ({ signal } = {}) => {
    const response = await api.get('/admin/users', { signal });
    return response.data;
  },
  audit: async ({ signal } = {}) => {
    const response = await api.get('/admin/audit?limit=60', { signal });
    return response.data;
  },
  appointments: async ({ signal } = {}) => {
    const response = await api.get('/admin/appointments', { signal });
    return response.data;
  },
};

export const kycQuery = async ({ signal } = {}) => api.get('/compliance/kyc/mine', { signal });
