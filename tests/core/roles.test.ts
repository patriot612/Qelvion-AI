import { describe, expect, it } from 'vitest';
import { toggleRole } from '../../src/features/tools/roles';

describe('role toggles', () => {
  it('activates on first click and deactivates on second click', () => {
    const active = toggleRole({ roleKey: null }, 'writer');
    expect(active.roleKey).toBe('writer');
    expect(toggleRole(active, 'writer').roleKey).toBeNull();
  });
});
