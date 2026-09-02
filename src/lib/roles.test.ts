import { roleOf, roleLabel, canManage, canSeeMoney, isAdultRole } from './roles';

describe('roleOf', () => {
  it('uses the role column when present', () => {
    expect(roleOf({ role: 'conselheiro', is_mor: false })).toBe('conselheiro');
    expect(roleOf({ role: 'mor', is_mor: false })).toBe('mor');
  });

  it('falls back to is_mor before migration 00008', () => {
    expect(roleOf({ is_mor: true })).toBe('mor');
    expect(roleOf({ is_mor: false })).toBe('guardiao');
    expect(roleOf({ role: undefined, is_mor: true })).toBe('mor');
    expect(roleOf(null)).toBe('guardiao');
  });
});

describe('roleLabel', () => {
  it('inflects by gender and stays neutral when unknown', () => {
    expect(roleLabel({ role: 'conselheiro', gender: 'f' })).toBe('Conselheira');
    expect(roleLabel({ role: 'conselheiro', gender: 'm' })).toBe('Conselheiro');
    expect(roleLabel({ role: 'conselheiro' })).toBe('Conselheiro(a)');
    expect(roleLabel({ is_mor: true, gender: 'f' })).toBe('Guardiã-Mor');
    expect(roleLabel({ is_mor: true })).toBe('Guardião-Mor');
    expect(roleLabel({ is_mor: false, gender: 'f' })).toBe('Guardiã');
  });
});

describe('powers', () => {
  it('the Mor always manages and sees money', () => {
    expect(canManage('mor', { equal_powers: false })).toBe(true);
    expect(canSeeMoney('mor', { advisors_see_reward: false })).toBe(true);
  });

  it('advisors manage only with equal powers', () => {
    expect(canManage('conselheiro', { equal_powers: false })).toBe(false);
    expect(canManage('conselheiro', { equal_powers: true })).toBe(true);
    expect(canManage('conselheiro', null)).toBe(false);
  });

  it('advisors see money by default, unless the family hides it', () => {
    expect(canSeeMoney('conselheiro', null)).toBe(true);
    expect(canSeeMoney('conselheiro', { advisors_see_reward: true })).toBe(true);
    expect(canSeeMoney('conselheiro', { advisors_see_reward: false })).toBe(false);
  });

  it('children never manage nor see money', () => {
    expect(canManage('guardiao', { equal_powers: true })).toBe(false);
    expect(canSeeMoney('guardiao', { advisors_see_reward: true })).toBe(false);
    expect(isAdultRole('guardiao')).toBe(false);
    expect(isAdultRole('conselheiro')).toBe(true);
  });
});
