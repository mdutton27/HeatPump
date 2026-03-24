import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing share ID' });
    }

    const { data, error } = await supabase
      .from('saved_models')
      .select('model_state')
      .eq('share_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Model not found' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Load model error:', err);
    return res.status(500).json({ error: 'Failed to load model' });
  }
}
