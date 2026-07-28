export const AI_OPERATIONS_CONTRACT_VERSION = 'ai-operations.v1';

export function createAIControlPlane({ now = () => new Date() } = {}) {
  const events = [];
  const record = (type, payload = {}) => {
    const event = Object.freeze({ type, at: new Date(now()).toISOString(), ...payload });
    events.push(event);
    if (events.length > 200) events.splice(0, events.length - 200);
    return event;
  };
  return Object.freeze({
    version: AI_OPERATIONS_CONTRACT_VERSION,
    recordCanary: (payload) => record('canary', payload),
    recordFeedback: (payload) => record('feedback', payload),
    recordDrift: (payload) => record('drift', payload),
    recordRollback: (payload) => record('rollback', payload),
    getEvents: () => events.slice(),
    status: () => Object.freeze({ version: AI_OPERATIONS_CONTRACT_VERSION, eventCount: events.length, rollbackAvailable: events.some((event) => event.type === 'rollback'), operatorRequired: true })
  });
}
