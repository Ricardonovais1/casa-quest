// ============================================================
// Casa Quest — Lib: Papéis e rótulos
//
// Três papéis: Guardião-Mor (decide), Conselheiro(a) (adulto da gestão
// diária) e Guardião (criança, entra por link). O gênero é opcional e
// serve só para flexionar os rótulos.
// Puro, sem I/O.
// ============================================================

export type Role = 'mor' | 'conselheiro' | 'guardiao';
export type Gender = 'm' | 'f' | null | undefined;

export interface RoleSubject {
  role?: string | null;
  is_mor?: boolean | null;
  gender?: Gender;
}

export interface FamilyPowers {
  equal_powers?: boolean | null;
  advisors_see_reward?: boolean | null;
}

/**
 * Role of a guardian row. Falls back to `is_mor` so the app keeps working
 * before migration 00008 adds the column.
 */
export function roleOf(g: RoleSubject | null | undefined): Role {
  if (!g) return 'guardiao';
  if (g.role === 'mor' || g.role === 'conselheiro' || g.role === 'guardiao') return g.role;
  return g.is_mor ? 'mor' : 'guardiao';
}

export function isAdultRole(role: Role): boolean {
  return role === 'mor' || role === 'conselheiro';
}

/** A child (link access, gets daily actions, has energy). */
export function isChild(g: RoleSubject | null | undefined): boolean {
  return roleOf(g) === 'guardiao';
}

/** An adult of the house (Mor or Conselheiro). */
export function isAdult(g: RoleSubject | null | undefined): boolean {
  return isAdultRole(roleOf(g));
}

/** May change rules, missions, reward, registrations. */
export function canManage(role: Role, family?: FamilyPowers | null): boolean {
  if (role === 'mor') return true;
  if (role === 'conselheiro') return !!family?.equal_powers;
  return false;
}

/** May see money (mesada). Children never do. */
export function canSeeMoney(role: Role, family?: FamilyPowers | null): boolean {
  if (role === 'mor') return true;
  if (role === 'conselheiro') return family?.advisors_see_reward !== false;
  return false;
}

const LABELS: Record<Role, { m: string; f: string; neutral: string }> = {
  mor: { m: 'Guardião-Mor', f: 'Guardiã-Mor', neutral: 'Guardião-Mor' },
  conselheiro: { m: 'Conselheiro', f: 'Conselheira', neutral: 'Conselheiro(a)' },
  guardiao: { m: 'Guardião', f: 'Guardiã', neutral: 'Guardião' },
};

/** "Conselheira", "Guardiã-Mor", "Conselheiro(a)" when gender is unknown. */
export function roleLabel(g: RoleSubject | null | undefined): string {
  const role = roleOf(g);
  const gender = g?.gender;
  if (gender === 'm') return LABELS[role].m;
  if (gender === 'f') return LABELS[role].f;
  return LABELS[role].neutral;
}

export function roleEmoji(role: Role): string {
  return role === 'mor' ? '👑' : role === 'conselheiro' ? '🧭' : '🦸';
}

/** Short description of what the role does, for forms and tooltips. */
export function roleDescription(role: Role): string {
  switch (role) {
    case 'mor':
      return 'Configura as regras, decide a mesada e gerencia a casa.';
    case 'conselheiro':
      return 'Confirma ações, registra tropeços e extras e acompanha a energia.';
    default:
      return 'Entra pelo link, vê as ações do dia e marca “Fiz!”.';
  }
}

/** Plural for a mixed or unknown group: "Guardiões", "Conselheiros(as)". */
export function rolePlural(role: Role, allFeminine = false): string {
  if (role === 'mor') return allFeminine ? 'Guardiãs-Mor' : 'Guardiões-Mor';
  if (role === 'conselheiro') return allFeminine ? 'Conselheiras' : 'Conselheiros';
  return allFeminine ? 'Guardiãs' : 'Guardiões';
}
