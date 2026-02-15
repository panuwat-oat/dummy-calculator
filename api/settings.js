import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    const { method } = request;
    const deviceId = request.query.deviceId || request.body?.deviceId;

    if (!deviceId) return response.status(400).json({ error: 'Device ID required' });

    if (method === 'GET') {
      const { rows } = await sql`SELECT last_player_names FROM user_settings WHERE device_id = ${deviceId}`;
      if (rows.length === 0) return response.status(200).json(null);
      return response.status(200).json(rows[0].last_player_names);
    }

    if (method === 'POST') {
      const { lastPlayerNames } = request.body;
      
      await sql`
        INSERT INTO user_settings (device_id, last_player_names, updated_at)
        VALUES (${deviceId}, ${JSON.stringify(lastPlayerNames)}, NOW())
        ON CONFLICT (device_id) 
        DO UPDATE SET 
          last_player_names = EXCLUDED.last_player_names,
          updated_at = NOW();
      `;
      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
