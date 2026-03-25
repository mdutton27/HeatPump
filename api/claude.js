export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { model, max_tokens, messages } = req.body;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: max_tokens || 1000,
          messages,
        }),
      });

      const data = await response.json();

      if (response.status === 429 && attempt < maxRetries) {
        // Use retry-after header if provided, otherwise exponential backoff
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(2000 * Math.pow(2, attempt), 30000);
        console.log(`[claude proxy] 429 rate limited, retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    } catch (err) {
      if (attempt < maxRetries) {
        const waitMs = 2000 * Math.pow(2, attempt);
        console.log(`[claude proxy] Network error, retry ${attempt + 1}/${maxRetries} in ${waitMs}ms:`, err.message);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      console.error('Proxy error after retries:', err);
      return res.status(500).json({ error: 'Internal proxy error' });
    }
  }
}
