/**
 * Single entry point for every catalogue template (T01–T29): one renderer per
 * ID, one content per product slot. Catalogue thumbnails use the fixtures here.
 */
import { TEMPLATES } from '../registry/manifest';
import type { LabelComposition } from '../renderer-contract';
import { hasPosterRenderer, POSTER_FIXTURES, renderPoster, SINGLE_POSTER_FIXTURE, type PosterShared } from './a4-posters';
import { hasTalkerRenderer, renderTalker, TALKER_FIXTURE, type TalkerContent } from './shelf-talkers';

export function hasTemplateRenderer(templateId: string) {
  return hasTalkerRenderer(templateId) || hasPosterRenderer(templateId);
}

export function slotCount(templateId: string): 1 | 2 | 3 {
  return TEMPLATES.find((t) => t.id === templateId)?.productSlots ?? 1;
}

/** Shelf talkers ignore slots beyond the first; posters use one content per slot. */
export function renderTemplate(
  templateId: string,
  contents: (TalkerContent | null)[],
  shared: PosterShared & { listText?: string } = {},
): LabelComposition {
  if (hasPosterRenderer(templateId)) return renderPoster(templateId, contents, shared);
  const first = contents[0] ?? { name: '' };
  return renderTalker(templateId, {
    ...first,
    headline: shared.headline ?? first.headline,
    listText: shared.listText ?? first.listText,
    footer: shared.footer ?? first.footer,
  });
}

export function templateFixtures(templateId: string): TalkerContent[] {
  if (!hasPosterRenderer(templateId)) return [TALKER_FIXTURE];
  const slots = slotCount(templateId);
  return slots > 1 ? POSTER_FIXTURES.slice(0, slots) : [SINGLE_POSTER_FIXTURE];
}

export function renderTemplateFixture(templateId: string): LabelComposition {
  return renderTemplate(templateId, templateFixtures(templateId));
}
