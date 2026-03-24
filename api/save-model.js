import { createClient } from '@supabase/supabase-js';

function generateShareId() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

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
    const { email, tos_accepted, marketing_opt_in, model_state } = req.body;

    if (!email || !tos_accepted || !model_state) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const share_id = generateShareId();

    const { data, error } = await supabase
      .from('saved_models')
      .insert({
        share_id,
        email,
        tos_accepted,
        marketing_opt_in: marketing_opt_in || false,
        model_state
      })
      .select('share_id')
      .single();

    if (error) throw error;

    // Send confirmation email via Resend (if configured)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const siteUrl = process.env.SITE_URL || 'https://heat-pump-omega.vercel.app';
      const modelLink = `${siteUrl}/model/${share_id}`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Heat Pump Calculator <noreply@resend.dev>',
            to: email,
            subject: 'Your Heat Pump Payback Results',
            html: `
              <h2>Your Heat Pump Payback Results</h2>
              <p>Thanks for using the Heat Pump Payback Calculator.</p>
              <p><strong>View and adjust your saved model:</strong><br>
              <a href="${modelLink}">${modelLink}</a></p>
              ${model_state.results ? `
              <h3>Key Results</h3>
              <ul>
                <li>Payback year: ${model_state.results.paybackYr ? 'Year ' + model_state.results.paybackYr : 'Beyond model horizon'}</li>
                <li>Install cost: $${Math.round(model_state.results.installCost || 0).toLocaleString()}</li>
                <li>Year 1 saving: $${Math.round(model_state.results.yr1Saving || 0).toLocaleString()}/yr</li>
                <li>25-year total saving: $${Math.round(model_state.results.saving25 || 0).toLocaleString()}</li>
              </ul>` : ''}
              <p style="color:#888; font-size:12px;">This is an indicative estimate only and does not constitute financial advice.</p>
            `
          })
        });
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
        // Don't fail the save if email fails
      }
    }

    return res.status(200).json({ share_id: data.share_id });
  } catch (err) {
    console.error('Save model error:', err);
    return res.status(500).json({ error: 'Failed to save model' });
  }
}
