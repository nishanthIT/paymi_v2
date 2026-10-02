/** LabelItem + template text settings → shelf-talker content (prices via parseMoneyText). */
import type { LabelItem } from '../model/label-item';
import { parseMoneyText } from '../model/money';
import type { TalkerContent } from './shelf-talkers';

export interface TalkerSettings {
  headline: string;
  listText: string;
  footer: string;
}

export function readTalkerSettings(stored: Record<string, unknown>): TalkerSettings {
  return { headline: '', listText: '', footer: '', ...(stored as Partial<TalkerSettings>) };
}

export function itemToTalkerContent(item: LabelItem | undefined, settings: TalkerSettings): TalkerContent {
  const price = parseMoneyText(item?.priceText ?? '');
  const was = parseMoneyText(item?.wasText ?? '');
  const total = parseMoneyText(item?.offerTotalText ?? '');
  const qty = Number(item?.offerQuantityText);
  return {
    name: item?.snapshot.displayName ?? '',
    brand: item?.snapshot.brand || undefined,
    packSize: item?.snapshot.packSize || undefined,
    imageUri: item?.snapshot.imageUri,
    priceMinor: price.kind === 'ok' && price.minor > 0 ? price.minor : undefined,
    wasMinor: was.kind === 'ok' && was.minor > 0 ? was.minor : undefined,
    offer:
      Number.isInteger(qty) && qty >= 2 && total.kind === 'ok' && total.minor > 0
        ? { quantity: qty, totalMinor: total.minor }
        : undefined,
    headline: settings.headline.trim() || undefined,
    listText: settings.listText.trim() || undefined,
    footer: settings.footer.trim() || undefined,
  };
}
