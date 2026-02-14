import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    const { method } = request;
    const { deviceId } = request.query;

    if (method === 'GET') {
      if (!deviceId) return response.status(400).json({ error: 'Device ID required' });
      
      const { rows } = await sql`
        SELECT * FROM game_history 
        WHERE device_id = ${deviceId} 
        ORDER BY created_at DESC
      `;
      return response.status(200).json(rows);
    }

    if (method === 'POST') {
      const { deviceId, winner, rounds, players, date } = request.body;
      if (!deviceId) return response.status(400).json({ error: 'Device ID required' });

      await sql`
        INSERT INTO game_history (device_id, winner, rounds, players, date)
        VALUES (${deviceId}, ${winner}, ${rounds}, ${JSON.stringify(players)}, ${date || new Date().toISOString()})
      `;
      return response.status(201).json({ success: true });
    }

    if (method === 'DELETE') {
      // Clear history for user
      if (!deviceId) return response.status(400).json({ error: 'Device ID required' });
      
      await sql`DELETE FROM game_history WHERE device_id = ${deviceId}`;
      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
