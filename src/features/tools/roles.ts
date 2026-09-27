export interface RoleState {
  roleKey: string | null;
}

export function toggleRole(state: RoleState, roleKey: string): RoleState {
  return { roleKey: state.roleKey === roleKey ? null : roleKey };
}
