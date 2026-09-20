import crypto from 'node:crypto';
import { CATALOG, DURATIONS, allProducts, isValidSelection, selectionKey } from './catalog.js';
import { config, jidToNumber, asJid } from './config.js';
import { completed, adminHelp, help, support, welcome } from './messages.js';
import { paymentInstructions } from './services/payments.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const splitPipe = (text) => String(text || '').split('|').map((x) => x.trim());
const isAdmin = (jid) => config.adminNumbers.includes(jidToNumber(jid)) || config.ownerNumber === jidToNumber(jid);
const productLines = (store) => Object.entries(CATALOG).map(([platform, products]) => `*${platform}*\n${products.map((product) => `• ${product}\n  Duraciones: ${DURATIONS.map((d) => `${d} ${money(store.getPrice(selectionKey(platform, product, d)))} (stock ${store.stockCount(selectionKey(platform, product, d))})`).join(' · ')}`).join('\n')}`).join('\n\n');

export function createCommandHandler({ store, sock, logger, hwid }) {
  const send = (jid, text, quoted) => sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
  return async function handleCommand({ message, text, senderJid, pushName, sourceJid }) {
    const number = jidToNumber(senderJid); if (!number || !sourceJid) return;
    if (!store.canRun(`msg:${number}`, config.rateLimitMs)) return;
    await store.markRun(`msg:${number}`); await store.registerUser({ number, name: pushName || '', sourceJid });
    const normalized = String(text || '').trim(); const [raw, ...rest] = normalized.split(/\s+/); const command = (raw || 'menu').toLowerCase(); const args = rest.join(' ').trim();
    const reply = (body) => send(sourceJid, body, message);

    if (command === 'start' || command === 'menu' || command === 'inicio') return reply(welcome());
    if (command === 'ayuda' || command === 'cmds') return reply(help());
    if (command === 'soporte') return reply(support(config.supportNumber));
    if (command === 'catalogo' || command === 'catalog') return reply(`🛍️ *CATÁLOGO Y STOCK*\n\n${productLines(store)}\n\nPara comprar: .comprar Plataforma | Producto | Duración`);
    if (command === 'comprar') {
      if (!args) return reply('🛒 *COMPRAR*\n\nUsa exactamente:\n.comprar Android | BR Mods — Root | 1 Día\n\nConsulta .catalogo para ver nombres y precios configurados.');
      const [platform, product, duration] = splitPipe(args); if (!isValidSelection(platform, product, duration)) return reply('Selección inválida. Usa .catalogo y copia Plataforma | Producto | Duración.');
      const key = selectionKey(platform, product, duration); const price = store.getPrice(key); if (price <= 0) return reply('Este producto todavía no tiene precio configurado. Contacta al administrador.'); if (store.stockCount(key) < 1) return reply('Este producto está agotado para la duración seleccionada.');
      const id = `BV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`; const order = await store.createOrder({ id, userNumber: number, platform, product, duration, price, selectionKey: key }); await store.log('order_created', number, { orderId: id, key });
      return reply(`🛒 *CONFIRMAR COMPRA*\n\n📦 Producto: ${product}\n📱 Plataforma: ${platform}\n⏱️ Opción: ${duration}\n💵 Precio: ${money(price)} DÓLARES\n🧾 Pedido: ${id}\n\nPara confirmar y recibir las instrucciones de pago:\n.confirmar ${id}`);
    }
    if (command === 'confirmar') {
      const order = store.getOrder(args); if (!order || order.userNumber !== number) return reply('No encontré ese pedido para tu usuario.'); if (order.status !== 'Pendiente de pago') return reply(`El pedido ${order.id} ya está en estado: ${order.status}.`);
      await store.log('payment_requested', number, { orderId: order.id }); return reply(`${paymentInstructions(config, order)}\n\nCuando pagues, envía el comprobante a soporte. El administrador validará la transacción.`);
    }
    if (command === 'pedido' || command === 'pedidos') {
      const orders = store.userOrders(number); if (!orders.length) return reply('📦 No tienes pedidos registrados.');
      return reply(`📦 *MIS PEDIDOS*\n\n${orders.map((o) => { const k = store.keyForOrder(o); return `🧾 ${o.id}\n📦 ${o.product}\n📱 ${o.platform}\n⏱️ ${o.duration}\n💵 ${money(o.price)}\n📌 ${o.status}\n🔑 ${k?.value || 'Pendiente de pago'}\n📅 ${o.createdAt}`; }).join('\n\n')}`);
    }
    if (command === 'keys') { const keys = store.userOrders(number).filter((o) => o.keyId); return reply(keys.length ? `🔐 *MIS KEYS*\n\n${keys.map((o) => `${o.product} — ${o.duration}\n${store.keyForOrder(o)?.value}\nEstado: ${o.status}`).join('\n\n')}` : '🔐 No tienes Keys entregadas.'); }
    if (command === 'reset') {
      const value = args.trim(); const found = Object.values(store.snapshot.keys).find((k) => k.value === value); if (!found || found.userNumber !== number || found.status !== 'Vendida') return reply('La Key no existe, no está activa o no pertenece a tu usuario.'); if (store.resetsToday(number) >= 2) return reply('Alcanzaste el límite de 2 resets por día.');
      const result = await hwid.reset({ key: value, productId: config.productId }); await store.addReset({ key: value, userNumber: number, ok: result.ok, code: result.code || 'ok' }); await store.log('hwid_reset', number, { key: value, ok: result.ok }); return reply(result.ok ? '✅ Reset de HWID realizado correctamente.' : `⚠️ No se pudo completar el reset: ${result.message}`);
    }
    if (command === 'admin') return handleAdmin(args, { number, senderJid, reply });
    return reply(`Comando no reconocido. Usa ${config.prefix}ayuda.`);

    async function handleAdmin(input, context) {
      if (!isAdmin(context.senderJid)) return context.reply('Este panel está restringido a administradores autorizados.');
      const [subRaw, ...subRest] = String(input || '').split(/\s+/); const sub = (subRaw || 'help').toLowerCase(); const payload = subRest.join(' ').trim();
      if (sub === 'help') return context.reply(adminHelp());
      if (sub === 'catalogo' || sub === 'productos') return context.reply(`📦 *PRODUCTOS*\n\n${productLines(store)}`);
      if (sub === 'stock' && !payload) return context.reply(`📋 *STOCK*\n\n${productLines(store)}`);
      if (sub === 'stock') {
        const lines = payload.split('\n'); const [platform, product, duration] = splitPipe(lines.shift()); if (!isValidSelection(platform, product, duration)) return context.reply('Formato inválido. Usa .admin stock Plataforma | Producto | Duración y luego una Key por línea.');
        const selection = selectionKey(platform, product, duration); const items = lines.map((value) => ({ id: crypto.randomUUID(), value: value.trim(), selectionKey: selection, platform, product, duration, addedBy: context.number })).filter((x) => x.value); const result = await store.addKeys(items); await store.log('stock_added', context.number, { selection, added: result.added, duplicates: result.duplicates.length }); return context.reply(`✅ STOCK ACTUALIZADO\n\n📦 Producto: ${product}\n📱 Plataforma: ${platform}\n⏱️ Duración: ${duration}\n🔑 Keys agregadas: ${result.added}\n📦 Stock disponible: ${result.stock}${result.duplicates.length ? `\n⚠️ Duplicadas rechazadas: ${result.duplicates.length}` : ''}`);
      }
      if (sub === 'precio') { const [platform, product, duration, priceRaw] = splitPipe(payload); const price = Number(priceRaw); if (!isValidSelection(platform, product, duration) || !Number.isFinite(price) || price < 0) return context.reply('Formato inválido. Usa .admin precio Plataforma | Producto | Duración | 4.70'); const key = selectionKey(platform, product, duration); await store.setPrice(key, price); await store.log('price_changed', context.number, { key, price }); return context.reply(`✅ Precio actualizado: ${product} / ${duration} = ${money(price)}`); }
      if (sub === 'precios') return context.reply(`💰 *PRECIOS Y STOCK*\n\n${productLines(store)}`);
      if (sub === 'aprobar') { const [orderId, transactionId] = payload.split(/\s+/); if (!orderId || !transactionId) return context.reply('Uso: .admin aprobar PEDIDO TRANSACCION'); try { const result = await store.approveOrder(orderId, { transactionId, method: config.paymentMode }); if (result.duplicate) return context.reply('La confirmación ya fue procesada; no se entregó otra Key.'); await store.log('payment_approved', context.number, { orderId, transactionId }); await send(asJid(result.order.userNumber), completed(result.order, result.key)); return context.reply(`✅ Pago aprobado y Key entregada para ${orderId}.`); } catch (error) { return context.reply(error.message === 'stock_empty' ? 'No hay stock disponible para ese pedido.' : 'No se pudo aprobar el pedido. Verifica el ID.'); } }
      if (sub === 'pedidos') return context.reply(`🛒 *PEDIDOS*\n\n${Object.values(store.snapshot.orders).slice(-30).reverse().map((o) => `${o.id} — ${o.userNumber} — ${o.status} — ${money(o.price)}`).join('\n') || 'Sin pedidos.'}`);
      if (sub === 'usuarios') return context.reply(`👥 Usuarios registrados: ${Object.keys(store.snapshot.users).length}`);
      if (sub === 'ventas') { const sold = Object.values(store.snapshot.orders).filter((o) => ['Key entregada', 'Activo'].includes(o.status)); return context.reply(`📊 *VENTAS*\n\nVentas completadas: ${sold.length}\nIngresos: ${money(sold.reduce((sum, o) => sum + o.price, 0))}`); }
      if (sub === 'logs') return context.reply(`📋 *LOGS RECIENTES*\n\n${store.snapshot.logs.slice(-20).reverse().map((l) => `${l.createdAt} — ${l.action} — ${l.actor}`).join('\n') || 'Sin logs.'}`);
      if (sub === 'hwid') return context.reply(`🔐 HWID API: ${hwid.configured ? 'configurada' : 'no configurada'}\n\nNo se inventará una API. Configura API_URL, API_KEY y RESET_ENDPOINT cuando el proveedor los entregue.`);
      if (sub === 'reset') { const value = payload; const found = Object.values(store.snapshot.keys).find((k) => k.value === value); if (!found) return context.reply('Key no encontrada.'); const result = await hwid.reset({ key: value, productId: config.productId }); await store.addReset({ key: value, userNumber: context.number, admin: true, ok: result.ok }); return context.reply(result.ok ? '✅ Reset administrativo realizado.' : `⚠️ ${result.message}`); }
      return context.reply(adminHelp());
    }
  };
}
