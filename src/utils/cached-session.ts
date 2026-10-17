// This is a local expiry/identity consistency check, not JWT signature verification.
// The backend always verifies signatures and current permissions before private API access.
export function cachedSessionMatches(token: string, user: { id: string | number; userType: string } | null, now = Date.now()) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return !!user && Number.isFinite(claims.exp) && claims.exp * 1000 > now && String(claims.id) === String(user.id) && claims.userType === user.userType;
  } catch { return false; }
}
