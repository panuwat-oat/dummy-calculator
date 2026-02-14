import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    const { method } = request;
    const { deviceId } = request.query;

    if (!deviceId) return response.status(400).json({ error: 'Device ID required' });

    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM active_games WHERE device_id = ${deviceId}`;
      if (rows.length === 0) return response.status(200).json(null);
      return response.status(200).json(rows[0]);
    }

    if (method === 'POST') {
      const { active, playerNames, scores, log } = request.body;
      
      // Upsert (INSERT ON CONFLICT UPDATE)
      await sql`
        INSERT INTO active_games (device_id, active, player_names, scores, log, updated_at)
        VALUES (${deviceId}, ${active}, ${JSON.stringify(playerNames)}, ${JSON.stringify(scores)}, ${JSON.stringify(log)}, NOW())
        ON CONFLICT (device_id) 
        DO UPDATE SET 
          active = EXCLUDED.active,
          player_names = EXCLUDED.player_names,
          scores = EXCLUDED.scores,
          log = EXCLUDED.log,
          updated_at = NOW();
      `;
      return response.status(200).json({ success: true });
    }

    if (method === 'DELETE') {
      // Instead of delete, we set active to false
      await sql`
        UPDATE active_games 
        SET active = false, updated_at = NOW() 
        WHERE device_id = ${deviceId}
      `;
      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
