export function paymentInstructions(config, order) {
  const body = config.paymentInstructions || 'Contacta a soporte para recibir instrucciones de pago.';
  return `💳 MÉTODO DE PAGO\n\n${body}\n\n🧾 ID DEL PEDIDO: ${order.id}\n💵 Total: $${order.price.toFixed(2)} dólares\n\nEnvía el comprobante y el ID del pedido. La Key solo se entrega después de una aprobación válida.`;
}

export function validatePaymentEvent(event, secret) {
  if (!event || typeof event !== 'object') return { ok: false, reason: 'evento_invalido' };
  if (secret && event.secret !== secret) return { ok: false, reason: 'firma_invalida' };
  if (!event.transactionId || !event.orderId || !['approved', 'rejected', 'refunded'].includes(event.status)) {
    return { ok: false, reason: 'campos_incompletos' };
  }
  return { ok: true };
}
