export function createAIProvider({ request = async () => ({ ok: false, error: 'AI_PROVIDER_UNAVAILABLE' }) } = {}) {
  return Object.freeze({
    async complete(envelope, options = {}) {
      try {
        const result = await request(envelope, options);
        return result && typeof result === 'object' ? result : { ok: false, error: 'AI_PROVIDER_INVALID_RESPONSE' };
      } catch (error) {
        return { ok: false, error: error?.name === 'AbortError' ? 'AI_PROVIDER_ABORTED' : 'AI_PROVIDER_REQUEST_FAILED' };
      }
    }
  });
}
