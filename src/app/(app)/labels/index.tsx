import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { HeaderEllipsis, LabelsScreen } from '@/features/labels/components/labels-screen';
import { MenuSheet } from '@/features/labels/components/labels-menu';
import { LabelsTabs, type LabelsTabKey } from '@/features/labels/components/labels-tabs';
import { CommunityTab, RecentTab, SavedTab } from '@/features/labels/components/library-tabs';
import { PrinterInfoSheet } from '@/features/labels/components/printer-info';
import { ToolCard } from '@/features/labels/components/tool-card';
import {
  ThumbMixedSheet,
  ThumbReduced,
  ThumbSelPromo,
  ThumbSelStandard,
  ThumbShelfRunner,
  ThumbShelfTalker,
} from '@/features/labels/components/tool-thumbnails';
import { useLabelLibrary } from '@/features/labels/hooks/use-label-library';
import { LABEL_TOOLS, type LabelToolId } from '@/features/labels/registry/manifest';
import { LabelTokens as T } from '@/features/labels/tokens';

const THUMBS: Record<LabelToolId, React.ReactNode> = {
  SEL_STANDARD: <ThumbSelStandard />,
  SEL_PROMO: <ThumbSelPromo />,
  REDUCED_STICKER: <ThumbReduced />,
  SHELF_TALKER: <ThumbShelfTalker />,
  SHELF_RUNNER: <ThumbShelfRunner />,
  MIXED_SHEET: <ThumbMixedSheet />,
};

/** Labels landing (reference R22/R04): four tabs and the six entry tools. */
export default function LabelsLandingScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<LabelsTabKey>('new');
  const library = useLabelLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);

  return (
    <LabelsScreen
      title="Labels"
      right={<HeaderEllipsis onPress={() => setMenuOpen(true)} />}
      headerBottom={<LabelsTabs active={tab} onChange={setTab} />}
    >
      {tab === 'new' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {LABEL_TOOLS.map((tool) => (
            <ToolCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              thumbnail={THUMBS[tool.id]}
              onPress={() => router.push(tool.route as never)}
            />
          ))}
        </ScrollView>
      )}
      {tab === 'recent' && <RecentTab library={library} />}
      {tab === 'saved' && <SavedTab library={library} />}
      {tab === 'community' && <CommunityTab />}

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { key: 'printer', icon: 'printer-outline', label: 'Printing & PDF help', onPress: () => setPrinterOpen(true) },
          { key: 'saved', icon: 'bookmark-outline', label: 'Saved labels', onPress: () => setTab('saved') },
          {
            key: 'history',
            icon: 'history',
            label: library.jobs.length ? 'Clear PDF history' : 'No PDF history to clear',
            disabled: !library.jobs.length,
            confirm: 'Tap again to clear — drafts and saved labels are kept',
            onPress: async () => {
              await library.clearJobs();
              showToast('PDF history cleared', 'success');
            },
          },
        ]}
      />
      <PrinterInfoSheet visible={printerOpen} onClose={() => setPrinterOpen(false)} />
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: T.insetPage,
    paddingTop: T.insetPage,
    paddingBottom: 40,
    gap: 12,
  },
});
