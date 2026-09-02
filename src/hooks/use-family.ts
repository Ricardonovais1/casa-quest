'use client';

// ============================================================
// Casa Quest — Hook: useFamily
//
// Loads the logged-in adult's family, members and settings, and tells
// the UI what this person may do (role, canManage, canSeeMoney).
//
// The data lives in a small module-level store shared by every page and
// by the navigation, so moving between pages does not refetch and the
// menu knows the role without a second request.
// ============================================================

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';
import {
  roleOf,
  canManage as computeCanManage,
  canSeeMoney as computeCanSeeMoney,
  isChild,
  isAdult,
  type Role,
} from '@/lib/roles';

export interface FamilyData {
  id: string;
  name: string;
  timezone: string;
  quorum_type: string;
  quorum_small_family: number;
  quorum_large_family: number;
  quorum_threshold: number;
  quorum_fixed: number;
  tolerance_minutes: number;
  recovery_enabled: boolean;
  recovery_value: number;
  auxilio_enabled: boolean;
  escalada_enabled: boolean;
  mission_duration_days: number;
  rotation_interval_months: number;
  /** Migration 00008 */
  equal_powers?: boolean;
  advisors_see_reward?: boolean;
}

export interface GuardianData {
  id: string;
  family_id: string;
  name: string;
  age: number | null;
  avatar_url: string | null;
  is_mor: boolean;
  is_active: boolean;
  email: string | null;
  user_id: string | null;
  /** Migration 00008 */
  role?: 'mor' | 'conselheiro' | 'guardiao';
  gender?: 'm' | 'f' | null;
  /** Plain token, readable only by the family (RLS). Used to rebuild the link. */
  access_token: string | null;
  access_token_hash: string | null;
  token_expires_at: string | null;
  created_at: string;
}

interface Snapshot {
  family: FamilyData | null;
  guardians: GuardianData[];
  /** The logged-in adult's own row. */
  me: GuardianData | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const INITIAL: Snapshot = {
  family: null,
  guardians: [],
  me: null,
  loading: true,
  loaded: false,
  error: null,
};

let snapshot: Snapshot = INITIAL;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forget everything (sign-out, account switch). */
export function resetFamilyCache() {
  snapshot = INITIAL;
  inflight = null;
  listeners.forEach((l) => l());
}

async function claimInvite(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/claim', { method: 'POST' });
    const body = await res.json().catch(() => null);
    return !!body?.data?.member;
  } catch {
    return false;
  }
}

async function fetchAll(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      emit({ error: 'Não autenticado', loading: false, loaded: true });
      return;
    }

    // My own guardian row (Mor or Conselheiro). select('*') keeps this
    // working before migration 00008 adds role/gender.
    let { data: mine } = await supabase
      .from('guardians')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);

    if (!mine || mine.length === 0) {
      // Invited by e-mail? Link the account, then retry once.
      if (await claimInvite()) {
        ({ data: mine } = await supabase.from('guardians').select('*').eq('user_id', user.id).limit(1));
      }
    }

    const me = (mine?.[0] as GuardianData | undefined) ?? null;
    if (!me || !isAdult(me)) {
      // Account without a family: finish onboarding.
      window.location.replace('/onboarding');
      return;
    }

    const { data: fam, error: famError } = await supabase
      .from('families')
      .select('*')
      .eq('id', me.family_id)
      .single();

    if (famError || !fam) {
      emit({ error: 'Família não encontrada', loading: false, loaded: true });
      return;
    }

    const { data: allGuardians } = await supabase
      .from('guardians')
      .select('*')
      .eq('family_id', fam.id)
      .order('is_mor', { ascending: false })
      .order('name');

    emit({
      family: fam as FamilyData,
      guardians: (allGuardians ?? []) as GuardianData[],
      me,
      loading: false,
      loaded: true,
      error: null,
    });
  } catch {
    emit({ error: 'Erro ao carregar dados', loading: false, loaded: true });
  } finally {
    inflight = null;
  }
}

function load(force = false) {
  if (inflight) return inflight;
  if (snapshot.loaded && !force) return Promise.resolve();
  if (force) emit({ loading: true, error: null });
  inflight = fetchAll();
  return inflight;
}

export function useFamily() {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => INITIAL);

  useEffect(() => {
    load();
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') resetFamilyCache();
    });
    return () => subscription.unsubscribe();
  }, []);

  /** Manual refresh: shows the loading state again, then refetches. */
  const reload = useCallback(async () => {
    await load(true);
  }, []);

  const role: Role = roleOf(snap.me);
  const canManage = computeCanManage(role, snap.family);
  const canSeeMoney = computeCanSeeMoney(role, snap.family);
  const kids = snap.guardians.filter(isChild);
  const adults = snap.guardians.filter(isAdult);
  const morGuardian = snap.guardians.find((g) => roleOf(g) === 'mor') ?? null;
  // Migration 00008 applied? (role/gender columns come back from select('*'))
  const schemaHasRoles = !!snap.me && 'role' in snap.me;

  return {
    /** False until migration 00008 (papéis) is applied. */
    schemaHasRoles,
    family: snap.family,
    guardians: snap.guardians,
    /** Children only (link access, energy, missions). */
    kids,
    /** Mor + Conselheiros. */
    adults,
    /** The logged-in adult. */
    me: snap.me,
    morGuardian,
    role,
    canManage,
    canSeeMoney,
    loading: snap.loading,
    error: snap.error,
    reload,
  };
}
