import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';

test('Store conserva datos y serializa escrituras concurrentes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-bot-'));
  const store = new Store(path.join(dir, 'data.json'));
  await store.init();
  await Promise.all([
    store.registerUser({ number: '5215512345678', name: 'A', sourceJid: '5215512345678@s.whatsapp.net' }),
    store.registerUser({ number: '5215512345679', name: 'B', sourceJid: '5215512345679@s.whatsapp.net' }),
    store.addReport({ id: 'r1', targetNumber: '5215512345680', status: 'pending' }),
  ]);
  const parsed = JSON.parse(await fs.readFile(path.join(dir, 'data.json'), 'utf8'));
  assert.equal(Object.keys(parsed.users).length, 2);
  assert.equal(parsed.reports.length, 1);
  await fs.rm(dir, { recursive: true, force: true });
});

test('Store aplica cooldown por clave', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-bot-'));
  const store = new Store(path.join(dir, 'data.json'));
  await store.init();
  assert.equal(store.canRun('user', 1000), true);
  await store.markRun('user');
  assert.equal(store.canRun('user', 1000), false);
  await fs.rm(dir, { recursive: true, force: true });
});
