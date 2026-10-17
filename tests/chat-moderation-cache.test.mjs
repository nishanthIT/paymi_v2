import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { upsertThreadMessage, removeThreadMessage } from '../src/features/chat/cache.ts';
import { chatKeys } from '../src/features/chat/keys.ts';

test('simultaneous global and open-thread delivery does not duplicate messages; moderation removes every cached page copy', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime:0 } } });
  const message = { id:'reported', chatId:'one', content:'synthetic', senderId:1, senderType:'CUSTOMER', isOwnMessage:false, messageType:'TEXT', timestamp:'2026-10-13T00:00:00Z' };
  const peer = { ...message, id:'peer' };
  client.setQueryData(chatKeys.thread('one'), { pages:[{messages:[peer]},{messages:[message]}], pageParams:[1,2] });
  client.setQueryData(chatKeys.thread('two'), { pages:[{messages:[peer]}],pageParams:[1] });
  upsertThreadMessage(client,'one',message); upsertThreadMessage(client,'one',message);
  assert.equal(client.getQueryData(chatKeys.thread('one')).pages[0].messages.filter(m=>m.id===message.id).length,1);
  removeThreadMessage(client,'one',message.id); removeThreadMessage(client,'one',message.id);
  const remaining=client.getQueryData(chatKeys.thread('one')).pages.flatMap(p=>p.messages);
  assert.deepEqual(remaining.map(m=>m.id),['peer']);
  assert.equal(client.getQueryData(chatKeys.thread('two')).pages[0].messages.length,1);
  client.clear();
});
