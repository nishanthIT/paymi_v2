import test from 'node:test';
import assert from 'node:assert/strict';
import { formatConversationDate, conversationActivity } from '../src/features/chat/dates.ts';
import { patchChatSummary } from '../src/features/chat/cache.ts';
import { QueryClient } from '@tanstack/react-query';
import { chatKeys } from '../src/features/chat/keys.ts';
test('conversation dates use local time, Yesterday and older dates across year boundaries', () => {
  const now=new Date(2026,0,1,0,10),today=new Date(2026,0,1,0,5),yesterday=new Date(2025,11,31,23,59),older=new Date(2025,11,30,12);
  assert.equal(formatConversationDate(today.toISOString(),now),today.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  assert.equal(formatConversationDate(yesterday.toISOString(),now),'Yesterday');
  assert.equal(formatConversationDate(older.toISOString(),now),older.toLocaleDateString([],{day:'2-digit',month:'2-digit',year:'2-digit'}));
  assert.equal(formatConversationDate('invalid',now),''); assert.equal(formatConversationDate(null,now),'');
});
test('activity sorting survives stale timestamps and out-of-order socket messages', () => {
  const client=new QueryClient({defaultOptions:{queries:{gcTime:0}}});
  client.setQueryData(chatKeys.all,[{id:'older',lastMessageTime:'2026-10-13T10:00:00Z'},{id:'newer',lastMessage:'latest',lastMessageTime:'2026-10-13T12:00:00Z'}]);
  patchChatSummary(client,'newer',chat=>({...chat,lastMessage:'late delivery',lastMessageTime:'2026-10-13T11:00:00Z',unreadCount:1}));
  const rows=client.getQueryData(chatKeys.all);assert.equal(rows[0].id,'newer');assert.equal(rows[0].lastMessage,'latest');assert.equal(rows[0].unreadCount,1);
  assert.equal(conversationActivity({lastMessageTime:'invalid'}),0); client.clear();
});
