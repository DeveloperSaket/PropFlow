import { db } from '../db.js';
import { config } from '../config.js';

const updateAgentFlag = db.prepare('UPDATE users SET is_agent = ? WHERE id = ?');

export async function checkAgentStatus(user) {
  const { url, apiKey, market, timeoutMs } = config.agentDetection;
  if (!url) return;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      market,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);

  const result = await response.json();
  if (typeof result.is_agent !== 'boolean') {
    throw new Error('Provider response must include a boolean is_agent field');
  }

  updateAgentFlag.run(result.is_agent ? 1 : 0, user.id);
}