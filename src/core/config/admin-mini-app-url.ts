export function resolveAdminMiniAppUrl(origin: string, configuredUrl?: string): string {
  const configured = configuredUrl?.trim();
  if (configured) return configured;
  return new URL('/admin/', origin).toString();
}
