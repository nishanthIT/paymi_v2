import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMessageDay, messageDay, startsMessageDay, topVisibleMessage } from '../src/features/chat/thread-dates.ts';

function withTimezone(timezone, fn) {
  const original = process.env.TZ;
  try { process.env.TZ = timezone; fn(); }
  finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

test('thread dates use the viewer calendar day, including midnight and historical years', () => {
  withTimezone('Asia/Kolkata', () => {
    const now = new Date('2026-01-01T00:10:00+05:30');
    assert.equal(formatMessageDay('2025-12-31T18:35:00Z', now), 'Today');
    assert.equal(formatMessageDay('2025-12-31T18:29:00Z', now), 'Yesterday');
    const historical = '2024-10-02T10:30:00Z';
    assert.equal(formatMessageDay(historical, now), new Date(historical).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }));
    assert.equal(messageDay('2025-12-31T18:35:00Z'), '2026-1-1');
    assert.equal(formatMessageDay('invalid', now), '');
    assert.equal(formatMessageDay(null, now), '');
    assert.equal(messageDay(undefined), null);
  });
});

test('Yesterday follows local calendar dates across both UK daylight-saving boundaries', () => {
  withTimezone('Europe/London', () => {
    assert.equal(formatMessageDay('2026-03-29T00:01:00Z', new Date('2026-03-30T00:15:00+01:00')), 'Yesterday');
    assert.equal(formatMessageDay('2026-10-25T00:10:00+01:00', new Date('2026-10-26T00:15:00Z')), 'Yesterday');
  });
});

test('day separators stay above the oldest message in each day across loaded pages', () => {
  withTimezone('Europe/London', () => {
    const messages = [
      { id: 'today-newer', timestamp: '2026-10-15T13:00:00Z' },
      { id: 'today-older', timestamp: '2026-10-15T12:00:00Z' },
      { id: 'yesterday-newer', timestamp: '2026-10-14T13:00:00Z' },
    ];
    assert.deepEqual(messages.map((_, index) => startsMessageDay(messages, index)), [false, true, true]);
    const loaded = [...messages, { id: 'yesterday-older', timestamp: '2026-10-14T11:00:00Z' }, { id: 'old', timestamp: '2024-08-01T10:00:00Z' }];
    assert.deepEqual(loaded.map((_, index) => startsMessageDay(loaded, index)), [false, true, false, true, true]);
    assert.equal(startsMessageDay([{ timestamp: 'invalid' }], 0), false);
    assert.equal(startsMessageDay([], 0), false);
    assert.equal(startsMessageDay([{ timestamp: '2026-10-15T13:00:00Z' }, { timestamp: null }], 0), true);
    assert.equal(messages[2].id, 'yesterday-newer');
  });
});

test('floating date follows the top visible inverted row regardless of event order or offscreen messages', () => {
  const newest = { id: 'newest', timestamp: '2026-10-15T12:00:00Z' };
  const top = { id: 'top', timestamp: '2024-01-01T12:00:00Z' };
  const tokens = [
    { item: newest, index: 0, isViewable: true },
    { item: { timestamp: '2023-01-01T00:00:00Z' }, index: 33, isViewable: false },
    { item: top, index: 31, isViewable: true },
    { item: { timestamp: 'invalid' }, index: 32, isViewable: true },
    { item: newest, index: null, isViewable: true },
  ];
  assert.equal(topVisibleMessage(tokens), top);
  assert.equal(topVisibleMessage([...tokens].reverse()), top);
  assert.equal(topVisibleMessage([{ item: newest, index: 0, isViewable: true }]), newest);
  assert.equal(topVisibleMessage([]), null);
  assert.equal(topVisibleMessage([{ item: top, index: -1, isViewable: true }]), null);
  assert.equal(topVisibleMessage([{ item: { timestamp: 'invalid' }, index: 0, isViewable: true }]), null);
});
