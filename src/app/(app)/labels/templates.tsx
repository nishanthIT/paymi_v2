import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LabelsScreen } from '@/features/labels/components/labels-screen';
import { TemplateRow } from '@/features/labels/components/template-row';
import { APP_MARKET } from '@/features/labels/registry/catalogue-meta';
import { TEMPLATES } from '@/features/labels/registry/manifest';
import { hasTemplateRenderer } from '@/features/labels/render/templates';
import { LabelTokens as T } from '@/features/labels/tokens';

/**
 * Pick a template (R05–R12). Catalogue order, section headings, titles and
 * subtitles come straight from the manifest (T01–T29).
 */
export default function PickTemplateScreen() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  const visible = TEMPLATES.filter(
    (template) => hasTemplateRenderer(template.id) && (showAll || template.markets.includes(APP_MARKET)),
  );
  const sections: { title: string; items: typeof visible }[] = [];
  for (const template of visible) {
    const last = sections[sections.length - 1];
    if (last?.title === template.section) last.items.push(template);
    else sections.push({ title: template.section, items: [template] });
  }

  return (
    <LabelsScreen
      title="Pick a template"
      right={
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          hitSlop={10}
          style={styles.showAll}
          accessibilityRole="button"
          accessibilityState={{ selected: showAll }}
        >
          <MaterialCommunityIcons name={showAll ? 'filter-outline' : 'filter-off-outline'} size={20} color={T.accent} />
          <Text style={styles.showAllText}>{showAll ? `${APP_MARKET} only` : 'Show all'}</Text>
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.market}>
          {showAll ? 'Showing all templates' : `Showing templates for ${APP_MARKET}`}
        </Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onPress={() => router.push({ pathname: '/(app)/labels/template/[id]', params: { id: template.id } })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </LabelsScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: T.insetList,
    paddingTop: 14,
    paddingBottom: 48,
  },
  showAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showAllText: {
    fontSize: 15.5,
    color: T.accent,
  },
  market: {
    fontSize: 14,
    color: T.textSecondary,
    marginBottom: 6,
  },
  section: {
    gap: 10,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 18.5,
    color: T.text,
    marginLeft: 4,
  },
});
