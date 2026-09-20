export function createHwidService(config, logger) {
  const configured = config.hwidMode === 'api' && config.apiUrl && config.apiKey && config.resetEndpoint;
  return {
    configured: Boolean(configured),
    async reset({ key, productId }) {
      if (!configured) return { ok: false, code: 'not_configured', message: 'La API HWID del proveedor no está configurada.' };
      const endpoint = config.resetEndpoint.replace('{key}', encodeURIComponent(key));
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ key, productId: productId || config.productId }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.text();
      if (!response.ok) {
        logger.warn({ status: response.status, payload: payload.slice(0, 300) }, 'Proveedor HWID rechazó el reset');
        return { ok: false, code: 'provider_rejected', message: 'El proveedor rechazó el reset.' };
      }
      return { ok: true, providerResponse: payload.slice(0, 500) };
    },
  };
}
