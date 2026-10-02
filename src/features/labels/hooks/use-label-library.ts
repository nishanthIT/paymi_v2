import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';

import { parseStoredDraft, type LabelDraft } from '../model/draft';
import {
  addJob,
  addSaved,
  deleteSaved,
  draftStorageKey,
  duplicateSaved,
  libraryKeys,
  parseList,
  renameSaved,
  snapshot,
  type PrintJob,
  type SavedLabel,
} from '../model/library';
import { isDraftEmpty } from '../render/draft-preview';

/**
 * Device-local Recent / Saved library for the signed-in shop + user (no
 * label backend exists yet). Every write re-reads storage first, so two
 * screens using the hook can't overwrite each other's changes.
 */
export function useLabelLibrary({ load = true }: { load?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user ? String(user.id) : '';
  const shopId = user ? String(user.shopId ?? 'none') : '';
  const keys = user ? libraryKeys(userId, shopId) : null;
  const savedKey = keys?.saved;
  const jobsKey = keys?.jobs;
  const prefix = keys?.draftPrefix;

  const [saved, setSaved] = useState<SavedLabel[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [drafts, setDrafts] = useState<LabelDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!savedKey || !jobsKey || !prefix) return;
    const [rawSaved, rawJobs, allKeys] = await Promise.all([
      AsyncStorage.getItem(savedKey),
      AsyncStorage.getItem(jobsKey),
      AsyncStorage.getAllKeys(),
    ]);
    const draftKeys = allKeys.filter((k) => k.startsWith(prefix));
    const pairs = draftKeys.length ? await AsyncStorage.multiGet(draftKeys) : [];
    const live = pairs
      .map(([k, raw]) => parseStoredDraft(raw, k.slice(prefix.length)))
      .filter((d): d is LabelDraft => !!d && !isDraftEmpty(d))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    setSaved(parseList<SavedLabel>(rawSaved));
    setJobs(parseList<PrintJob>(rawJobs));
    setDrafts(live);
    setLoaded(true);
  }, [savedKey, jobsKey, prefix]);

  useFocusEffect(
    useCallback(() => {
      if (load) refresh().catch(() => setLoaded(true));
    }, [load, refresh]),
  );

  const mutate = useCallback(async <T extends { id: string }>(key: string | undefined, fn: (list: T[]) => T[]) => {
    if (!key) throw new Error('Sign in to save labels');
    const next = fn(parseList<T>(await AsyncStorage.getItem(key)));
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  }, []);

  const saveDraft = useCallback(
    async (draft: LabelDraft, name: string) => setSaved(await mutate<SavedLabel>(savedKey, (l) => addSaved(l, name, draft))),
    [mutate, savedKey],
  );
  const rename = useCallback(
    async (id: string, name: string) => setSaved(await mutate<SavedLabel>(savedKey, (l) => renameSaved(l, id, name))),
    [mutate, savedKey],
  );
  const duplicate = useCallback(async (id: string) => setSaved(await mutate<SavedLabel>(savedKey, (l) => duplicateSaved(l, id))), [mutate, savedKey]);
  const remove = useCallback(async (id: string) => setSaved(await mutate<SavedLabel>(savedKey, (l) => deleteSaved(l, id))), [mutate, savedKey]);

  const recordJob = useCallback(
    async (job: Omit<PrintJob, 'id' | 'createdAt'>) => setJobs(await mutate<PrintJob>(jobsKey, (l) => addJob(l, job))),
    [mutate, jobsKey],
  );
  const removeJob = useCallback(async (id: string) => setJobs(await mutate<PrintJob>(jobsKey, (l) => l.filter((j) => j.id !== id))), [mutate, jobsKey]);
  const clearJobs = useCallback(async () => setJobs(await mutate<PrintJob>(jobsKey, () => [])), [mutate, jobsKey]);

  const liveDraft = useCallback(
    async (toolId: string) => (userId ? parseStoredDraft(await AsyncStorage.getItem(draftStorageKey(userId, shopId, toolId)), toolId) : null),
    [userId, shopId],
  );

  /** Make a saved/job snapshot the tool's working draft (the snapshot itself is untouched). */
  const openSnapshot = useCallback(
    async (draft: LabelDraft) => {
      if (!userId) throw new Error('Sign in to open labels');
      await AsyncStorage.setItem(draftStorageKey(userId, shopId, draft.toolId), JSON.stringify({ ...snapshot(draft), updatedAt: Date.now() }));
    },
    [userId, shopId],
  );

  const discardDraft = useCallback(
    async (toolId: string) => {
      if (!userId) return;
      await AsyncStorage.removeItem(draftStorageKey(userId, shopId, toolId));
      setDrafts((d) => d.filter((x) => x.toolId !== toolId));
    },
    [userId, shopId],
  );

  return { saved, jobs, drafts, loaded, refresh, saveDraft, rename, duplicate, remove, recordJob, removeJob, clearJobs, liveDraft, openSnapshot, discardDraft };
}

export type LabelLibraryApi = ReturnType<typeof useLabelLibrary>;
