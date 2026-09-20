import fs from 'node:fs/promises';
import path from 'node:path';

const fresh = () => ({ users: {}, products: {}, keys: {}, orders: {}, payments: {}, logs: [], rateLimits: {}, resets: [] });
const now = () => new Date().toISOString();

export class Store {
  constructor(file) { this.file = path.resolve(file); this.state = fresh(); this.writeQueue = Promise.resolve(); this.mutex = Promise.resolve(); }
  async init() { await fs.mkdir(path.dirname(this.file), { recursive: true }); try { this.state = { ...fresh(), ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; await this.flush(); } }
  async flush() { const snapshot = JSON.stringify(this.state, null, 2); this.writeQueue = this.writeQueue.then(async () => { const tmp = `${this.file}.${process.pid}.tmp`; await fs.writeFile(tmp, snapshot, { mode: 0o600 }); await fs.rename(tmp, this.file); }); return this.writeQueue; }
  async transaction(fn) { const run = this.mutex.then(async () => { const result = await fn(this.state); await this.flush(); return result; }); this.mutex = run.catch(() => {}); return run; }
  async log(action, actor, details = {}) { return this.transaction((s) => { const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action, actor, details, createdAt: now() }; s.logs.push(entry); if (s.logs.length > 5000) s.logs.shift(); return entry; }); }
  async registerUser(user) { return this.transaction((s) => { const old = s.users[user.number] || {}; s.users[user.number] = { ...old, ...user, registeredAt: old.registeredAt || now(), updatedAt: now(), status: old.status || 'active' }; return s.users[user.number]; }); }
  getUser(number) { return this.state.users[number] || null; }
  canRun(key, cooldownMs) { return Date.now() - Number(this.state.rateLimits[key] || 0) >= cooldownMs; }
  async markRun(key) { return this.transaction((s) => { s.rateLimits[key] = Date.now(); return true; }); }
  async setPrice(key, price) { return this.transaction((s) => { s.products[key] = { ...(s.products[key] || {}), price: Number(price), updatedAt: now() }; return s.products[key]; }); }
  getPrice(key) { return Number(this.state.products[key]?.price || 0); }
  stockCount(key) { return Object.values(this.state.keys).filter((item) => item.selectionKey === key && item.status === 'Disponible').length; }
  async addKeys(items) { return this.transaction((s) => { let added = 0; const duplicates = []; for (const item of items) { const exists = Object.values(s.keys).some((k) => k.value === item.value); if (!item.value || exists) { if (exists) duplicates.push(item.value); continue; } s.keys[item.id] = { ...item, status: 'Disponible', createdAt: now() }; added += 1; } return { added, duplicates, stock: this.stockCount(items[0]?.selectionKey || '') }; }); }
  async createOrder(order) { return this.transaction((s) => { s.orders[order.id] = { ...order, status: 'Pendiente de pago', createdAt: now() }; return s.orders[order.id]; }); }
  getOrder(id) { return this.state.orders[id] || null; }
  userOrders(number) { return Object.values(this.state.orders).filter((o) => o.userNumber === number).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async approveOrder(id, payment) { return this.transaction((s) => { const order = s.orders[id]; if (!order) throw new Error('order_not_found'); if (['Key entregada', 'Activo'].includes(order.status)) return { order, duplicate: true }; const duplicatePayment = Object.values(s.payments).find((p) => p.transactionId === payment.transactionId && p.status === 'Aprobado'); if (duplicatePayment) return { order, duplicate: true }; const key = Object.values(s.keys).find((item) => item.selectionKey === order.selectionKey && item.status === 'Disponible'); if (!key) throw new Error('stock_empty'); s.payments[payment.transactionId] = { ...payment, orderId: id, status: 'Aprobado', createdAt: now() }; key.status = 'Vendida'; key.userNumber = order.userNumber; key.orderId = id; key.soldAt = now(); order.paymentId = payment.transactionId; order.status = 'Key entregada'; order.keyId = key.id; order.deliveredAt = now(); order.expiresAt = order.duration === 'Permanente' ? null : new Date(Date.now() + ({ '1 Día': 1, '3 Días': 3, '7 Días': 7, '15 Días': 15, '30 Días': 30 }[order.duration] || 1) * 86400000).toISOString(); return { order, key, duplicate: false }; }); }
  keyForOrder(order) { return order?.keyId ? this.state.keys[order.keyId] : null; }
  async addReset(reset) { return this.transaction((s) => { s.resets.push({ ...reset, createdAt: now() }); return s.resets.at(-1); }); }
  resetsToday(number) { const day = new Date().toISOString().slice(0, 10); return this.state.resets.filter((r) => r.userNumber === number && r.createdAt.startsWith(day)).length; }
  get snapshot() { return this.state; }
}
