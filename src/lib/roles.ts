export const SUPERADMIN_EMAIL = "zananrobin@gmail.com";

export function isSuperadminEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === SUPERADMIN_EMAIL;
}
