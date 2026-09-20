import crypto from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { config, jidToNumber, normalizeNumber } from './config.js';
import { loopUsage, menu, moderationAlert, reportUsage, support, welcome } from './messages.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validTarget(raw) {
  const number = normalizeNumber(raw);
  if (!number || number.length < 8 || number.length > 15) return null;
  const parsed = parsePhoneNumberFromString(`+${number}`);
  return parsed?.isValid() ? parsed.number.replace('+', '') : null;
}

function isAdmin(jid) {
  return config.adminNumbers.includes(jidToNumber(jid));
}

export function createCommandHandler({ store, sock, logger }) {
  return async function handleCommand({ message, text, senderJid, pushName, sourceJid }) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText || !sourceJid || !senderJid) return;
    const [rawCommand, ...args] = normalizedText.split(/\s+/);
    const command = rawCommand.toLowerCase();
    const reply = (content) => sock.sendMessage(sourceJid, { text: content }, { quoted: message });
    const reporterNumber = jidToNumber(senderJid);

    if (!reporterNumber) return reply('No fue posible identificar al remitente de este mensaje.');

    if (command === 'start') {
      await store.registerUser({ number: reporterNumber, name: pushName || '', sourceJid });
      return reply(welcome(pushName, config.botName));
    }

    if (command === 'cmds' || command === 'ayuda') return reply(menu(config.prefix));
    if (command === 'soporte') return reply(support(config.supportUrl, config.supportEmail));

    if (command === 'reportar') {
      const targetNumber = validTarget(args[0]);
      if (!targetNumber) return reply(reportUsage(config.prefix));
      if (targetNumber === reporterNumber) return reply('No puedes reportar tu propio número.');
      const rateKey = `report:${reporterNumber}`;
      if (!store.canRun(rateKey, config.reportCooldownMs)) {
        return reply('Ya registraste un reporte recientemente. Espera el cooldown antes de enviar otro.');
      }
      if (!config.moderationJid) {
        logger.warn('MODERATION_JID no está configurado; reporte no reenviado.');
        return reply('El canal de moderación todavía no está configurado. Contacta a soporte.');
      }
      const report = {
        id: crypto.randomUUID(),
        targetNumber,
        reporterNumber,
        reporterName: pushName || '',
        sourceJid,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      await store.addReport(report);
      try {
        await sock.sendMessage(config.moderationJid, { text: moderationAlert(report) });
        await store.updateReport(report.id, { status: 'sent', sentAt: new Date().toISOString() });
        await store.markRun(rateKey);
      } catch (error) {
        await store.updateReport(report.id, { status: 'delivery_failed', error: 'moderation_send_failed' });
        logger.error({ err: error, reportId: report.id }, 'No se pudo enviar el reporte a moderación');
        return reply(`El reporte fue guardado, pero no pudo enviarse a moderación. Folio: ${report.id.slice(0, 8)}.`);
      }
      return reply(`Reporte registrado con folio ${report.id.slice(0, 8)}. Será revisado por moderación.`);
    }

    if (command === 'bucle') {
      if (!isAdmin(senderJid)) return reply('Este comando está restringido a administradores.');
      const targetNumber = validTarget(args[0]);
      const iterations = /^\d+$/.test(args[1] || '') ? Number(args[1]) : NaN;
      if (!targetNumber || !Number.isSafeInteger(iterations) || iterations < 1 || iterations > config.maxLoopIterations) {
        return reply(loopUsage(config.prefix));
      }
      const rateKey = `loop:${reporterNumber}`;
      if (!store.canRun(rateKey, config.loopCooldownMs)) return reply('La simulación tiene cooldown activo. Intenta más tarde.');
      await store.markRun(rateKey);
      for (let index = 1; index <= iterations; index += 1) {
        logger.info({ targetNumber, index, iterations }, 'Simulación interna de revisión; no se contacta al objetivo');
        await sleep(250);
      }
      return reply(`Simulación interna completada: ${iterations} revisión(es) para +${targetNumber}. No se enviaron mensajes ni reportes repetitivos al objetivo.`);
    }

    return reply(`Comando no reconocido. Usa ${config.prefix}ayuda.`);
  };
}
