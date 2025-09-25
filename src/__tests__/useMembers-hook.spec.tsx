import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMembers } from '@/hooks/useMembers';

// Mocks
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userLoggedIn: true, loading: false })
}));
vi.mock('@/components/membership/hooks', () => ({
  useDocAdminFlag: () => ({ isAdmin: false, loadingAdmin: false }),
  useMembersSubscription: () => ({
    members: [
      { id: 'u1', displayName: 'Alice', email: 'a@test.local' },
      { id: 'u2', displayName: 'Bob', email: 'b@test.local' },
      { id: 'u3', displayName: 'Charlie', email: 'c@test.local' },
    ],
    loadingMembers: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useActiveMembers', () => ({
  useActiveMembers: () => ({ data: [ { userId: 'u2', year: 2099, membershipType: 'full', status: 'confirmed' } ], isLoading: false })
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMembers hook', () => {
  it('returns only active members for non-admin', () => {
    const { result } = renderHook(() => useMembers(2099), { wrapper });
    expect(result.current.members.map(m => m.id)).toEqual(['u2']);
    // allMembers preserves original list
    expect(result.current.allMembers.map(m => m.id)).toEqual(['u1','u2','u3']);
    expect(result.current.isAdmin).toBe(false);
  });
});
