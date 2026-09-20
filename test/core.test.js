import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';

test('Store conserva datos y serializa escrituras concurrentes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandon-ventas-'));
  const store = new Store(path.join(dir, 'data.json')); await store.init();
  await Promise.all([store.registerUser({ number: '5211', name: 'A' }), store.registerUser({ number: '5212', name: 'B' }), store.log('test', 'system')]);
  const parsed = JSON.parse(await fs.readFile(path.join(dir, 'data.json'), 'utf8')); assert.equal(Object.keys(parsed.users).length, 2); assert.equal(parsed.logs.length, 1);
  await fs.rm(dir, { recursive: true, force: true });
});

test('Stock rechaza Keys duplicadas y conserva el conteo', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandon-ventas-')); const store = new Store(path.join(dir, 'data.json')); await store.init();
  const selectionKey = 'Android::BR Mods — Root::1 Día';
  const result = await store.addKeys([{ id: '1', value: 'KEY-1', selectionKey }, { id: '2', value: 'KEY-1', selectionKey }, { id: '3', value: '', selectionKey }]);
  assert.equal(result.added, 1); assert.equal(result.duplicates.length, 1); assert.equal(store.stockCount(selectionKey), 1); await fs.rm(dir, { recursive: true, force: true });
});

test('Aprobación consume una sola Key y es idempotente ante repetición', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandon-ventas-')); const store = new Store(path.join(dir, 'data.json')); await store.init();
  const selectionKey = 'Android::BR Mods — Root::1 Día'; await store.addKeys([{ id: '1', value: 'KEY-1', selectionKey }]); await store.setPrice(selectionKey, 4.7);
  await store.createOrder({ id: 'BV-1', userNumber: '5211', platform: 'Android', product: 'BR Mods — Root', duration: '1 Día', price: 4.7, selectionKey });
  const first = await store.approveOrder('BV-1', { transactionId: 'TX-1', method: 'manual' }); const second = await store.approveOrder('BV-1', { transactionId: 'TX-1', method: 'manual' });
  assert.equal(first.key.value, 'KEY-1'); assert.equal(first.order.status, 'Key entregada'); assert.equal(second.duplicate, true); assert.equal(store.stockCount(selectionKey), 0); await fs.rm(dir, { recursive: true, force: true });
});

test('Rate limit bloquea una segunda ejecución dentro del cooldown', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'brandon-ventas-')); const store = new Store(path.join(dir, 'data.json')); await store.init(); assert.equal(store.canRun('u', 1000), true); await store.markRun('u'); assert.equal(store.canRun('u', 1000), false); await fs.rm(dir, { recursive: true, force: true });
});
