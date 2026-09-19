export const welcome = (name, botName) => `*${botName}*\n\nHola ${name || 'usuario'}, tu interacción fue inicializada correctamente.\n\nUsa *.cmds* o *.ayuda* para ver las opciones disponibles.`;

export const menu = (prefix) => `*Menú principal*\n\n${prefix}start — Registrar o actualizar tu usuario.\n${prefix}cmds / ${prefix}ayuda — Mostrar este menú.\n${prefix}soporte — Consultar los canales de asistencia humana.\n${prefix}reportar <número> — Registrar un reporte para revisión de moderación.\n${prefix}bucle <número> <veces> — Simular una revisión interna controlada (solo administradores).\n\n*Uso responsable:* los reportes se revisan manualmente; no se envían mensajes repetitivos al número reportado.`;

export const support = (url, email) => `*Soporte humano*\n\nCanal: ${url}\nCorreo: ${email}\n\nIncluye una descripción clara, fecha aproximada y evidencia pertinente. No compartas contraseñas ni códigos de verificación.`;

export const reportUsage = (prefix) => `Formato: ${prefix}reportar <número>\nEjemplo: ${prefix}reportar 5215512345678\n\nEl número se envía únicamente al canal de moderación configurado.`;

export const loopUsage = (prefix) => `Formato: ${prefix}bucle <número> <veces>\n\nPor seguridad, este comando no contacta ni reporta repetidamente al número indicado. Solo genera una simulación interna para pruebas de moderación y está restringido a administradores.`;

export const moderationAlert = (report) => `🚩 *Nuevo reporte para revisión*\n\nID: ${report.id}\nObjetivo: +${report.targetNumber}\nEmisor: +${report.reporterNumber}\nChat de origen: ${report.sourceJid}\nNombre: ${report.reporterName || 'No disponible'}\nFecha: ${report.createdAt}\n\nAcción requerida: validar evidencia y decidir conforme a las políticas aplicables.`;
