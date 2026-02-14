import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    const { method } = request;
    const { id } = request.query;

    if (method === 'GET') {
      // Check if room exists or get room data
      if (!id) return response.status(400).json({ error: 'Room ID required' });
      
      const { rows } = await sql`SELECT * FROM rooms WHERE room_id = ${id}`;
      if (rows.length === 0) {
        return response.status(404).json({ error: 'Room not found' });
      }
      return response.status(200).json(rows[0]);
    }

    if (method === 'POST') {
      // Create room
      const { roomId, hostId, playerNames } = request.body;
      if (!roomId || !hostId) return response.status(400).json({ error: 'Missing required fields' });

      // Default values
      const scores = JSON.stringify([0, 0, 0, 0]);
      const log = JSON.stringify([]);
      const names = JSON.stringify(playerNames);

      await sql`
        INSERT INTO rooms (room_id, host_id, player_names, scores, log, status)
        VALUES (${roomId}, ${hostId}, ${names}, ${scores}, ${log}, 'waiting')
      `;
      return response.status(201).json({ success: true, roomId });
    }

    if (method === 'PUT') {
      // Update room (join, update state)
      const { roomId, playerNames, scores, log, winner, status } = request.body;
      if (!roomId) return response.status(400).json({ error: 'Room ID required' });

      // Build update query dynamically or just update provided fields
      // For simplicity, we check what's provided
      
      if (playerNames) {
        await sql`UPDATE rooms SET player_names = ${JSON.stringify(playerNames)}, updated_at = NOW() WHERE room_id = ${roomId}`;
      }
      if (scores) {
        await sql`UPDATE rooms SET scores = ${JSON.stringify(scores)}, updated_at = NOW() WHERE room_id = ${roomId}`;
      }
      if (log) {
        await sql`UPDATE rooms SET log = ${JSON.stringify(log)}, updated_at = NOW() WHERE room_id = ${roomId}`;
      }
      if (winner !== undefined) {
        await sql`UPDATE rooms SET winner = ${winner}, updated_at = NOW() WHERE room_id = ${roomId}`;
      }
      if (status) {
        await sql`UPDATE rooms SET status = ${status}, updated_at = NOW() WHERE room_id = ${roomId}`;
      }

      return response.status(200).json({ success: true });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}
