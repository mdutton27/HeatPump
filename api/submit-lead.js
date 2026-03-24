import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { name, phone, suburb, best_time_to_call, model_data } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Derive region from suburb
    const regionMap = {
      'auckland': 'Auckland', 'north shore': 'Auckland', 'manukau': 'Auckland',
      'wellington': 'Wellington', 'karori': 'Wellington', 'lower hutt': 'Wellington',
      'upper hutt': 'Wellington', 'porirua': 'Wellington', 'petone': 'Wellington',
      'christchurch': 'Canterbury', 'canterbury': 'Canterbury',
      'hamilton': 'Waikato', 'waikato': 'Waikato',
      'dunedin': 'Otago', 'queenstown': 'Otago',
      'tauranga': 'Bay of Plenty', 'rotorua': 'Bay of Plenty',
    };
    const suburbLower = (suburb || '').toLowerCase();
    const region = Object.entries(regionMap).find(([k]) => suburbLower.includes(k))?.[1] || null;

    const { error } = await supabase
      .from('installer_leads')
      .insert({
        name,
        phone,
        suburb,
        region,
        best_time_to_call,
        model_data
      });

    if (error) throw error;

    // Email notification to nominated address
    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.LEAD_NOTIFY_EMAIL;
    if (resendKey && notifyEmail) {
      const results = model_data?.results;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Heat Pump Calculator <noreply@resend.dev>',
            to: notifyEmail,
            subject: `New installer lead: ${name} — ${suburb || 'unknown area'}`,
            html: `
              <h2>New Installer Lead</h2>
              <table>
                <tr><td><strong>Name:</strong></td><td>${name}</td></tr>
                <tr><td><strong>Phone:</strong></td><td>${phone}</td></tr>
                <tr><td><strong>Suburb:</strong></td><td>${suburb || '—'}</td></tr>
                <tr><td><strong>Region:</strong></td><td>${region || '—'}</td></tr>
                <tr><td><strong>Best time:</strong></td><td>${best_time_to_call || '—'}</td></tr>
              </table>
              ${results ? `
              <h3>Their Calculator Results</h3>
              <ul>
                <li>Payback: ${results.paybackYr ? 'Year ' + results.paybackYr : 'N/A'}</li>
                <li>Install cost: $${Math.round(results.installCost || 0).toLocaleString()}</li>
                <li>Annual saving: $${Math.round(results.yr1Saving || 0).toLocaleString()}</li>
                <li>HP type: ${model_data.quote?.hpType || '—'}</li>
              </ul>` : ''}
            `
          })
        });
      } catch (emailErr) {
        console.error('Lead notification email failed:', emailErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Submit lead error:', err);
    return res.status(500).json({ error: 'Failed to submit lead' });
  }
}
