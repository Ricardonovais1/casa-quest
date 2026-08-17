'use client';

// ============================================================
// Casa Quest — Hook: useFamily
// Loads the current user's family, guardians, and settings
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/infrastructure/supabase/client';

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
}

export interface GuardianData {
  id: string;
  family_id: string;
  name: string;
  age: number | null;
  avatar_url: string | null;
  is_mor: boolean;
  is_active: boolean;
  access_token_hash: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export function useFamily() {
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [guardians, setGuardians] = useState<GuardianData[]>([]);
  const [morGuardian, setMorGuardian] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Não autenticado');
        setLoading(false);
        return;
      }

      // Find the user's guardian profile (as Mor)
      const { data: mor, error: morError } = await supabase
        .from('guardians')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_mor', true)
        .single();

      if (morError || !mor) {
        setError('Guardião-Mor não encontrado. Complete o onboarding.');
        setLoading(false);
        return;
      }

      setMorGuardian(mor);

      // Load family
      const { data: fam, error: famError } = await supabase
        .from('families')
        .select('*')
        .eq('id', mor.family_id)
        .single();

      if (famError || !fam) {
        setError('Família não encontrada');
        setLoading(false);
        return;
      }

      setFamily(fam);

      // Load all guardians in the family
      const { data: allGuardians, error: gError } = await supabase
        .from('guardians')
        .select('*')
        .eq('family_id', fam.id)
        .order('is_mor', { ascending: false })
        .order('name');

      if (!gError && allGuardians) {
        setGuardians(allGuardians);
      }
    } catch (e) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { family, guardians, morGuardian, loading, error, reload: load };
}
