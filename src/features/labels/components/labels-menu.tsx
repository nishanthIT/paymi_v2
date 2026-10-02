import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useToast } from '@/components/ui/toast';

import type { LabelDraftApi } from '../hooks/use-label-draft';
import { useLabelLibrary } from '../hooks/use-label-library';
import { formatWhen, validateName } from '../model/library';
import { draftSummary, isDraftEmpty } from '../render/draft-preview';
import { LabelTokens as T } from '../tokens';
import { LabelField } from './label-field';
import { HeaderEllipsis } from './labels-screen';

export interface MenuItem {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  /** Destructive: needs a second tap showing this text before it runs. */
  confirm?: string;
  disabled?: boolean;
}

/** Ellipsis menu (inferred — the reference menus' contents aren't visible). */
export function MenuSheet({ visible, title, items, onClose }: { visible: boolean; title?: string; items: MenuItem[]; onClose: () => void }) {
  const [armed, setArmed] = useState<string | null>(null);
  const close = () => {
    setArmed(null);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close} sheetStyle={styles.sheet}>
      <View style={styles.content}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {items.map((item) => {
          const danger = !!item.confirm;
          const isArmed = armed === item.key;
          const colour = item.disabled ? T.textLight : danger ? T.error : T.text;
          return (
            <Pressable
              key={item.key}
              disabled={item.disabled}
              onPress={() => {
                if (danger && !isArmed) return setArmed(item.key);
                close();
                item.onPress();
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!item.disabled }}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color={colour} />
              <Text style={[styles.rowText, { color: colour }]}>{isArmed ? item.confirm : item.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={close} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Name a saved label (Save draft / Rename). */
export function NameSheet({
  visible,
  title,
  initial,
  actionLabel,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial: string;
  actionLabel: string;
  onSubmit: (name: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = name ?? initial;
  const error = name != null ? validateName(value) : null;
  const close = () => {
    setName(null);
    onClose();
  };
  const submit = async () => {
    if (validateName(value) || busy) return setName(value);
    setBusy(true);
    try {
      await onSubmit(value.trim());
      close();
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={close} keyboardAware sheetStyle={styles.sheet}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <LabelField label="Name" value={value} onChangeText={setName} error={error ?? undefined} autoFocus maxLength={80} returnKeyType="done" onSubmitEditing={submit} />
        <Pressable onPress={submit} disabled={busy} style={[styles.primary, busy && styles.pressed]} accessibilityRole="button">
          <Text style={styles.primaryText}>{actionLabel}</Text>
        </Pressable>
        <Pressable onPress={close} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Editor header ellipsis: Save draft, Clear draft, plus editor-specific items. */
export function EditorMenu({ labels, extra = [] }: { labels: LabelDraftApi; extra?: MenuItem[] }) {
  const { showToast } = useToast();
  const library = useLabelLibrary({ load: false });
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const empty = isDraftEmpty(labels.draft);
  const defaultName = `${draftSummary(labels.draft).title} · ${formatWhen(labels.draft.updatedAt)}`;

  return (
    <>
      <HeaderEllipsis onPress={() => setOpen(true)} />
      <MenuSheet
        visible={open}
        onClose={() => setOpen(false)}
        items={[
          { key: 'save', icon: 'content-save-outline', label: empty ? 'Save draft (add something first)' : 'Save draft…', disabled: empty, onPress: () => setNaming(true) },
          ...extra,
          {
            key: 'clear',
            icon: 'trash-can-outline',
            label: 'Clear draft',
            confirm: 'Tap again to clear — saved copies are kept',
            disabled: empty,
            onPress: () => {
              labels.clearDraft();
              showToast('Draft cleared', 'success');
            },
          },
        ]}
      />
      <NameSheet
        visible={naming}
        title="Save draft"
        initial={defaultName}
        actionLabel="Save"
        onClose={() => setNaming(false)}
        onSubmit={async (name) => {
          try {
            await library.saveDraft(labels.draft, name);
            showToast('Saved — find it under Labels › Saved', 'success');
          } catch (e: any) {
            showToast(e?.message ?? 'Couldn’t save', 'error');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: T.bg,
  },
  content: {
    padding: 20,
    gap: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    color: T.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
  },
  rowText: {
    flex: 1,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  primary: {
    height: 48,
    borderRadius: 14,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryText: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: T.accent,
  },
});
