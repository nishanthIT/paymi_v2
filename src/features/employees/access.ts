/** Mirrors backend per-shop permission levels; absence of a verified workspace grants no tool access. */
export function canUseShopFeature(user: {
  userType: string;
  shopId?: string;
  shopAccess?: { shopId: string; permissions: string[] } | null;
} | null, feature?: string, level: 'read' | 'write' | 'edit' = 'read'): boolean {
  if (!feature) return true;
  if (!user?.shopId) return false;
  if (user.userType === 'CUSTOMER' || user.userType === 'ADMIN') return true;
  if (user.userType !== 'EMPLOYEE' || user.shopAccess?.shopId !== user.shopId) return false;
  const permissions = user.shopAccess.permissions;
  return permissions.includes(feature) && permissions.includes(level === 'read' ? feature : `${feature}.${level}`);
}
