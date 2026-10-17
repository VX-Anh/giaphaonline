import type { FamilyContext } from '../families/access';
import { PersonRow, visibilityOf } from './policy';

const ctx = (role: FamilyContext['role'], userId = 'u1'): FamilyContext => ({ familyId: 'f', userId, role });
const person = (p: Partial<PersonRow>): PersonRow => ({
  id: 'p',
  living_status: 'deceased',
  basis_status: 'not_required',
  created_by: 'u1',
  ...p,
});

describe('privacy policy', () => {
  it('shows deceased people to everyone in the family, including viewers', () => {
    expect(visibilityOf(person({}), ctx('viewer'))).toBe('full');
  });

  it('masks living people from viewers but not members', () => {
    const living = person({ living_status: 'alive', basis_status: 'verified' });
    expect(visibilityOf(living, ctx('viewer'))).toBe('masked');
    expect(visibilityOf(living, ctx('member'))).toBe('full');
  });

  it('treats unknown living status like alive', () => {
    expect(visibilityOf(person({ living_status: 'unknown', basis_status: 'verified' }), ctx('viewer'))).toBe('masked');
  });

  it('hides unverified people from everyone except their creator and admins — role alone does not grant editors access', () => {
    const unverified = person({ living_status: 'alive', basis_status: 'unverified', created_by: 'creator' });
    expect(visibilityOf(unverified, ctx('editor', 'someone'))).toBe('hidden');
    expect(visibilityOf(unverified, ctx('member', 'someone'))).toBe('hidden');
    expect(visibilityOf(unverified, ctx('editor', 'creator'))).toBe('full');
    expect(visibilityOf(unverified, ctx('co_admin', 'someone'))).toBe('full');
  });

  it('hides erased records regardless of role', () => {
    expect(visibilityOf(person({ erased: true }), ctx('owner'))).toBe('hidden');
  });
});
