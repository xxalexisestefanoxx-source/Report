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
    const [rawCommand, ...args] = text.trim().split(/\s+/);
    const command = rawCommand.toLowerCase();
    const reply = (content) => sock.sendMessage(sourceJid, { text: content }, { quoted: message });

    if (command === 'start') {
      await store.registerUser({ number: jidToNumber(senderJid), name: pushName || '', sourceJid });
      return reply(welcome(pushName, config.botName));
    }

    if (command === 'cmds' || command === 'ayuda') return reply(menu(config.prefix));
    if (command === 'soporte') return reply(support(config.supportUrl, config.supportEmail));

    if (command === 'reportar') {
      const targetNumber = validTarget(args[0]);
      if (!targetNumber) return reply(reportUsage(config.prefix));
      const rateKey = `report:${jidToNumber(senderJid)}`;
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
        reporterNumber: jidToNumber(senderJid),
        reporterName: pushName || '',
        sourceJid,
        createdAt: new Date().toISOString(),
      };
      await store.addReport(report);
      await store.markRun(rateKey);
      await sock.sendMessage(config.moderationJid, { text: moderationAlert(report) });
      return reply(`Reporte registrado con folio ${report.id.slice(0, 8)}. Será revisado por moderación.`);
    }

    if (command === 'bucle') {
      if (!isAdmin(senderJid)) return reply('Este comando está restringido a administradores.');
      const targetNumber = validTarget(args[0]);
      const iterations = Number.parseInt(args[1], 10);
      if (!targetNumber || !Number.isInteger(iterations) || iterations < 1 || iterations > config.maxLoopIterations) {
        return reply(loopUsage(config.prefix));
      }
      const rateKey = `loop:${jidToNumber(senderJid)}`;
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
