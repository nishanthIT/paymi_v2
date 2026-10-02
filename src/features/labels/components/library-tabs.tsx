import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/ui/toast';

import type { LabelLibraryApi } from '../hooks/use-label-library';
import type { LabelDraft } from '../model/draft';
import { formatWhen, sameDraftContent, toolInfo, type JobOutcome, type PrintJob, type SavedLabel } from '../model/library';
import type { LabelComposition } from '../renderer-contract';
import { draftPreview, draftSummary } from '../render/draft-preview';
import { LabelTokens as T } from '../tokens';
import { CompositionView } from './composition-view';
import { useLabelOutput } from './label-output';
import { MenuSheet, NameSheet, type MenuItem } from './labels-menu';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const OUTCOME_TEXT: Record<JobOutcome, string> = {
  printed: 'Sent to printer',
  shared: 'PDF made',
  print_dialog: 'Print dialog opened',
  dialog: 'Print dialog opened',
};

function Preview({ composition }: { composition: LabelComposition | null }) {
  const scale = composition ? Math.min(64 / composition.widthMm, 50 / composition.heightMm) : 0;
  return (
    <View style={styles.tile}>
      {composition ? (
        <View style={styles.tileLabel}>
          <CompositionView composition={composition} scale={scale} />
        </View>
      ) : (
        <MaterialCommunityIcons name="label-outline" size={24} color={T.textLight} />
      )}
    </View>
  );
}

function LibraryRow({
  composition,
  title,
  subtitle,
  meta,
  onPress,
  onMore,
}: {
  composition: LabelComposition | null;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
  onMore: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}>
        <Preview composition={composition} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onMore} hitSlop={10} style={styles.more} accessibilityRole="button" accessibilityLabel={`More for ${title}`}>
        <Ionicons name="ellipsis-horizontal" size={20} color={T.text} />
      </Pressable>
    </View>
  );
}

function EmptyState({ icon, title, note }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; note: string }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={40} color={T.textLight} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyNote}>{note}</Text>
    </View>
  );
}

/** Open a tool; with a snapshot, make it the working draft — asking first if that would replace other work. */
function useOpenDraft(library: LabelLibraryApi) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<{ snapshot: LabelDraft; current: LabelDraft } | null>(null);

  const go = (toolId: string) => {
    const info = toolInfo(toolId);
    if (!info) return showToast('This label type isn’t available', 'error');
    router.push({ pathname: info.pathname, params: info.params } as never);
  };
  const load = async (snap: LabelDraft) => {
    await library.openSnapshot(snap);
    go(snap.toolId);
  };
  const open = async (toolId: string, snap?: LabelDraft) => {
    if (!snap) return go(toolId);
    const current = await library.liveDraft(toolId);
    if (current && library.drafts.some((d) => d.toolId === toolId) && !sameDraftContent(current, snap)) return setPending({ snapshot: snap, current });
    await load(snap);
  };

  const guard = (
    <MenuSheet
      visible={!!pending}
      title={pending ? `You’re already working on ${draftSummary(pending.current).title}` : undefined}
      onClose={() => setPending(null)}
      items={
        pending
          ? [
              {
                key: 'keep',
                icon: 'content-save-outline',
                label: 'Save that draft first, then open',
                onPress: async () => {
                  await library.saveDraft(pending.current, `${draftSummary(pending.current).title} · ${formatWhen(pending.current.updatedAt)}`);
                  await load(pending.snapshot);
                  showToast('Your earlier draft is in Saved', 'success');
                },
              },
              { key: 'replace', icon: 'file-replace-outline', label: 'Replace it', confirm: 'Tap again to replace — it can’t be recovered', onPress: () => load(pending.snapshot) },
            ]
          : []
      }
    />
  );
  return { open, guard };
}

export function RecentTab({ library }: { library: LabelLibraryApi }) {
  const { showToast } = useToast();
  const { open, guard } = useOpenDraft(library);
  const [menu, setMenu] = useState<{ title: string; items: MenuItem[] } | null>(null);
  const [saving, setSaving] = useState<LabelDraft | null>(null);
  const output = useLabelOutput();
  const reprint = (job: PrintJob) =>
    output.start({ title: job.title, pages: job.output === 'roll' ? Array.from({ length: job.copies }, () => job.pages[0]) : job.pages });

  if (!library.loaded) return <ActivityIndicator style={styles.loading} color={T.accent} />;
  if (!library.drafts.length && !library.jobs.length) {
    return <EmptyState icon="history" title="No recent labels" note="Labels you’re working on and PDFs you make will show up here." />;
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.list}>
        {library.drafts.length > 0 && <Text style={styles.section}>In progress</Text>}
        {library.drafts.map((d) => {
          const s = draftSummary(d);
          const items: MenuItem[] = [
            { key: 'open', icon: 'pencil-outline', label: 'Open', onPress: () => open(d.toolId) },
            { key: 'save', icon: 'content-save-outline', label: 'Save a copy to Saved…', onPress: () => setSaving(d) },
            { key: 'discard', icon: 'trash-can-outline', label: 'Discard draft', confirm: 'Tap again to discard this draft', onPress: () => library.discardDraft(d.toolId) },
          ];
          return (
            <LibraryRow
              key={d.toolId}
              composition={draftPreview(d)}
              title={s.title}
              subtitle={s.summary}
              meta={`Edited ${formatWhen(d.updatedAt)}`}
              onPress={() => open(d.toolId)}
              onMore={() => setMenu({ title: s.title, items })}
            />
          );
        })}
        {library.jobs.length > 0 && <Text style={styles.section}>PDFs made</Text>}
        {library.jobs.map((job) => {
          const pages = job.output === 'roll' ? job.copies : job.pages.length;
          const items: MenuItem[] = [
            { key: 'reprint', icon: 'printer-outline', label: output.busy ? 'Preparing…' : 'Print this PDF again', disabled: output.busy, onPress: () => reprint(job) },
            { key: 'edit', icon: 'pencil-outline', label: 'Edit a copy', onPress: () => open(job.toolId, job.draft) },
            { key: 'remove', icon: 'trash-can-outline', label: 'Remove from Recent', confirm: 'Tap again to remove', onPress: () => library.removeJob(job.id) },
          ];
          return (
            <LibraryRow
              key={job.id}
              composition={job.pages[0] ?? null}
              title={job.title}
              subtitle={job.summary}
              meta={`${formatWhen(job.createdAt)} · ${plural(pages, job.output === 'roll' ? 'sticker' : 'page')} · ${OUTCOME_TEXT[job.outcome] ?? 'Print dialog opened'}`}
              onPress={() => setMenu({ title: job.title, items })}
              onMore={() => setMenu({ title: job.title, items })}
            />
          );
        })}
      </ScrollView>
      <MenuSheet visible={!!menu} title={menu?.title} items={menu?.items ?? []} onClose={() => setMenu(null)} />
      <NameSheet
        visible={!!saving}
        title="Save a copy"
        initial={saving ? `${draftSummary(saving).title} · ${formatWhen(saving.updatedAt)}` : ''}
        actionLabel="Save"
        onClose={() => setSaving(null)}
        onSubmit={async (name) => {
          if (saving) await library.saveDraft(saving, name);
          showToast('Saved', 'success');
        }}
      />
      {guard}
      {output.sheet}
    </>
  );
}

export function SavedTab({ library }: { library: LabelLibraryApi }) {
  const { showToast } = useToast();
  const { open, guard } = useOpenDraft(library);
  const [menu, setMenu] = useState<SavedLabel | null>(null);
  const [renaming, setRenaming] = useState<SavedLabel | null>(null);

  if (!library.loaded) return <ActivityIndicator style={styles.loading} color={T.accent} />;
  if (!library.saved.length) {
    return <EmptyState icon="bookmark-outline" title="No saved labels" note="In any label editor, tap ••• › Save draft to keep a copy you can reuse." />;
  }
  return (
    <>
      <ScrollView contentContainerStyle={styles.list}>
        {library.saved.map((s) => (
          <LibraryRow
            key={s.id}
            composition={draftPreview(s.draft)}
            title={s.name}
            subtitle={`${draftSummary(s.draft).title} · ${draftSummary(s.draft).summary}`}
            meta={`Saved ${formatWhen(s.updatedAt)}`}
            onPress={() => open(s.toolId, s.draft)}
            onMore={() => setMenu(s)}
          />
        ))}
      </ScrollView>
      <MenuSheet
        visible={!!menu}
        title={menu?.name}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { key: 'open', icon: 'pencil-outline', label: 'Open', onPress: () => open(menu.toolId, menu.draft) },
                { key: 'rename', icon: 'form-textbox', label: 'Rename…', onPress: () => setRenaming(menu) },
                {
                  key: 'dup',
                  icon: 'content-copy',
                  label: 'Duplicate',
                  onPress: async () => {
                    await library.duplicate(menu.id);
                    showToast('Duplicated', 'success');
                  },
                },
                { key: 'delete', icon: 'trash-can-outline', label: 'Delete', confirm: 'Tap again to delete this saved label', onPress: () => library.remove(menu.id) },
              ]
            : []
        }
      />
      <NameSheet
        visible={!!renaming}
        title="Rename"
        initial={renaming?.name ?? ''}
        actionLabel="Rename"
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming) await library.rename(renaming.id, name);
        }}
      />
      {guard}
    </>
  );
}

/** No community-template service exists, so nothing is shown or published. */
export function CommunityTab() {
  return (
    <EmptyState
      icon="account-group-outline"
      title="No community templates"
      note="PayMi doesn’t have template sharing yet, so there’s nothing to browse here. Your drafts and saved labels stay private to your shop — nothing is shared from Labels."
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  loading: {
    marginTop: 40,
  },
  list: {
    paddingHorizontal: T.insetPage,
    paddingTop: T.insetPage,
    paddingBottom: 40,
    gap: 10,
  },
  section: {
    fontSize: 15.5,
    fontWeight: '600',
    color: T.text,
    marginTop: 6,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: T.radiusCard,
    borderWidth: 1,
    borderColor: T.border,
    paddingRight: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  tile: {
    width: 76,
    height: 60,
    borderRadius: T.radiusThumb,
    backgroundColor: T.thumbTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    borderWidth: 1,
    borderColor: T.labelOutline,
    backgroundColor: T.surface,
  },
  rowTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: T.text,
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: T.textSecondary,
    marginTop: 2,
  },
  rowMeta: {
    fontSize: 12,
    color: T.textLight,
    marginTop: 3,
  },
  more: {
    padding: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyTitle: {
    fontSize: T.fontCardTitle,
    fontWeight: '700',
    color: T.text,
  },
  emptyNote: {
    fontSize: T.fontBody,
    lineHeight: 20,
    color: T.textSecondary,
    textAlign: 'center',
  },
});
