export const labelIdentity = (userType: string, id: string | number) => `${userType}:${id}`;
export const draftStorageKey = (identity: string, shopId: string, toolId: string) => `labels.draft.v2.${shopId}.${identity}.${toolId}`;
export function libraryKeys(identity: string, shopId: string) {
  return { saved: `labels.saved.v2.${shopId}.${identity}`, jobs: `labels.jobs.v2.${shopId}.${identity}`, draftPrefix: draftStorageKey(identity, shopId, '') };
}
// Legacy keys do not prove which account type owns the content. Detect, preserve, never auto-import.
export function hasAmbiguousLegacyLabels(keys: readonly string[], id: string | number, shopId: string) {
  return keys.some(key => key.startsWith(`labels.draft.v1.${shopId}.${id}.`) || key === `labels.saved.v1.${shopId}.${id}` || key === `labels.jobs.v1.${shopId}.${id}`);
}
