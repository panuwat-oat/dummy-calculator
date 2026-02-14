import { auth } from '../firebase';

const DEVICE_ID_KEY = 'dummy_calculator_device_id';

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

const getUserId = () => {
    return auth.currentUser ? auth.currentUser.uid : getDeviceId();
};

// --- API Helpers ---

const API_BASE = '/api';

const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);
        
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'API Error');
        }
        return await res.json();
    } catch (error) {
        console.error(`API Call Error (${endpoint}):`, error);
        throw error;
    }
};

// --- Game History ---

export const saveGameHistory = async (gameData) => {
  try {
    const userId = getUserId();
    await apiCall('/history', 'POST', {
        deviceId: userId,
        ...gameData
    });
  } catch (error) {
    console.error("Error saving game history:", error);
  }
};

export const getGameHistory = async () => {
  try {
    const userId = getUserId();
    return await apiCall(`/history?deviceId=${userId}`);
  } catch (error) {
    console.error("Error getting game history:", error);
    return [];
  }
};

export const clearGameHistory = async () => {
    try {
        const userId = getUserId();
        await apiCall(`/history?deviceId=${userId}`, 'DELETE');
    } catch (error) {
        console.error("Error clearing history:", error);
    }
};

// --- Multiplayer Rooms ---

export const createRoom = async (initialNames) => {
    try {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
        const userId = getUserId();
        
        // Ensure we have 4 names
        const names = [...initialNames];
        while (names.length < 4) names.push('');

        await apiCall('/room', 'POST', {
            roomId,
            hostId: userId,
            playerNames: names
        });
        
        return roomId;
    } catch (error) {
        console.error("Error creating room:", error);
        throw error;
    }
};

export const checkRoomExists = async (roomId) => {
    try {
        await apiCall(`/room?id=${roomId}`);
        return true;
    } catch (error) {
        return false;
    }
};

export const joinRoom = async (roomId, playerName) => {
    try {
        const room = await apiCall(`/room?id=${roomId}`);
        let currentNames = room.player_names || ['', '', '', ''];

        // Find empty slot
        const emptyIndex = currentNames.findIndex(n => n === '' || n.trim() === '');
        
        // Or check if this player is already in the room (re-joining)
        const existingIndex = currentNames.findIndex(n => n === playerName);

        if (existingIndex !== -1) {
            return currentNames;
        }

        if (emptyIndex === -1) {
            throw new Error("Room is full!");
        }

        // Occupy the slot
        currentNames[emptyIndex] = playerName;
        
        await apiCall('/room', 'PUT', {
            roomId,
            playerNames: currentNames
        });

        return currentNames;
    } catch (error) {
        console.error("Error joining room:", error);
        throw error;
    }
};

export const updateRoomState = async (roomId, data) => {
    try {
        await apiCall('/room', 'PUT', {
            roomId,
            ...data
        });
    } catch (error) {
        console.error("Error updating room:", error);
    }
};

// Polling for Room Subscription
export const subscribeToRoom = (roomId, callback) => {
    let isActive = true;
    
    const poll = async () => {
        if (!isActive) return;
        try {
            const room = await apiCall(`/room?id=${roomId}`);
            if (isActive) {
                // Map DB keys to app keys if necessary (snake_case to camelCase)
                // Postgres returns `player_names`, app expects `playerNames`
                const mappedData = {
                    ...room,
                    playerNames: room.player_names,
                    scores: room.scores,
                    log: room.log,
                    status: room.status,
                    winner: room.winner
                };
                callback(mappedData);
            }
        } catch (error) {
            // Room might be gone or error
            console.warn("Polling error:", error);
        }
    };

    // Initial fetch
    poll();
    
    // Poll every 2 seconds
    const interval = setInterval(poll, 2000);

    return () => {
        isActive = false;
        clearInterval(interval);
    };
};

// --- User Settings ---

export const saveLastPlayerNames = async (names) => {
    try {
        const userId = getUserId();
        await apiCall('/settings', 'POST', {
            lastPlayerNames: names
        }); // Pass userId via query in apiCall? No, handler expects body or query.
        // Wait, handler expects deviceId in query for POST too? 
        // Let's fix the call:
        // My handler for POST uses query for deviceId too.
        await fetch(`${API_BASE}/settings?deviceId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastPlayerNames: names })
        });
    } catch (error) {
        console.error("Error saving last player names:", error);
    }
};

export const getLastPlayerNames = async () => {
    try {
        const userId = getUserId();
        return await apiCall(`/settings?deviceId=${userId}`);
    } catch (error) {
        return null;
    }
};

// --- Active Game (Single Player) ---

export const saveActiveGame = async (gameData) => {
    try {
        const userId = getUserId();
        await fetch(`${API_BASE}/active?deviceId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData)
        });
    } catch (error) {
        console.error("Error saving active game:", error);
    }
};

export const clearActiveGame = async () => {
    try {
        const userId = getUserId();
        await apiCall(`/active?deviceId=${userId}`, 'DELETE');
    } catch (error) {
        console.error("Error clearing active game:", error);
    }
};

// Polling for Active Game
export const subscribeToActiveGame = (callback) => {
    const userId = getUserId();
    let isActive = true;

    const poll = async () => {
        if (!isActive) return;
        try {
            const data = await apiCall(`/active?deviceId=${userId}`);
            if (isActive && data) {
                const mappedData = {
                    ...data,
                    playerNames: data.player_names,
                    // scores/log usually match
                };
                callback(mappedData);
            } else if (isActive && !data) {
                callback(null);
            }
        } catch (error) {
            // Ignore errors or callback(null)
        }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
        isActive = false;
        clearInterval(interval);
    };
};
