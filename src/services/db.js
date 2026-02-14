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

// --- User Settings ---

export const saveLastPlayerNames = async (names) => {
    try {
        const userId = getUserId();
        await apiCall(`/settings?deviceId=${userId}`, 'POST', {
            lastPlayerNames: names
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
        await apiCall(`/active?deviceId=${userId}`, 'POST', gameData);
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
