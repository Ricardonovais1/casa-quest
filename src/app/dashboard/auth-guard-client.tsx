'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

export function AuthGuardClient({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
