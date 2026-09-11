export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use as is
      }
    }

    const email = body?.email?.toString().trim().toLowerCase();
    const code = body?.code?.toString().trim();

    if (!email || !code || code.length !== 6) {
      return res.status(400).json({ error: 'Valid email and 6-digit code are required.' });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process verification.' });
  }
}
