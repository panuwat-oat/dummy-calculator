import { db, auth } from '../firebase';
import { collection, addDoc, query, where, orderBy, getDocs, doc, setDoc, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';

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

// History Collection
const HISTORY_COLLECTION = 'game_history';

export const saveGameHistory = async (gameData) => {
  try {
    const userId = getUserId();
    await addDoc(collection(db, HISTORY_COLLECTION), {
      ...gameData,
      deviceId: userId, // Use userId (auth uid or deviceId)
      createdAt: serverTimestamp(),
      date: new Date().toISOString() // Keep string date for compatibility
    });
  } catch (error) {
    console.error("Error saving game history:", error);
  }
};

export const getGameHistory = async () => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, HISTORY_COLLECTION),
      where("deviceId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting game history:", error);
    return [];
  }
};

export const clearGameHistory = async () => {
    // Note: Deleting collection in client is not recommended for large collections
    // For now we just won't implement clear all on server for safety, 
    // or we could delete them one by one.
    // Let's leave it as a future todo or implement deletion one by one.
    try {
        const userId = getUserId();
        const q = query(
            collection(db, HISTORY_COLLECTION),
            where("deviceId", "==", userId)
        );
        const querySnapshot = await getDocs(q);
        // Delete all docs (batching would be better but simple loop for now)
        // Ideally we shouldn't do this often.
        // For this task, maybe just clear local view? 
        console.warn("Clearing cloud history is not fully implemented to save quota.");
    } catch (error) {
        console.error("Error clearing history:", error);
    }
};

// Room Collection (Multiplayer)
const ROOMS_COLLECTION = 'rooms';

export const createRoom = async (initialNames) => {
    try {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
        const userId = getUserId();
        
        // Ensure we have 4 names
        const names = [...initialNames];
        while (names.length < 4) names.push('');

        const initialData = {
            roomId,
            hostId: userId,
            createdAt: serverTimestamp(),
            playerNames: names,
            scores: [0, 0, 0, 0],
            log: [],
            status: 'waiting',
            winner: null
        };
        
        await setDoc(doc(db, ROOMS_COLLECTION, roomId), initialData);
        return roomId;
    } catch (error) {
        console.error("Error creating room:", error);
        throw error;
    }
};

export const checkRoomExists = async (roomId) => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        const roomSnap = await import('firebase/firestore').then(mod => mod.getDoc(roomRef));
        return roomSnap.exists();
    } catch (error) {
        console.error("Error checking room:", error);
        return false;
    }
};

export const joinRoom = async (roomId, playerName) => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        let currentNames = [];

        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) {
                throw new Error("Room does not exist!");
            }

            const data = roomDoc.data();
            currentNames = [...(data.playerNames || ['', '', '', ''])];

            // Find empty slot
            const emptyIndex = currentNames.findIndex(n => n === '' || n.trim() === '');
            
            // Or check if this player is already in the room (re-joining)
            const existingIndex = currentNames.findIndex(n => n === playerName);

            if (existingIndex !== -1) {
                // Player already in room, do nothing, just return current state
                return;
            }

            if (emptyIndex === -1) {
                throw new Error("Room is full!");
            }

            // Occupy the slot
            currentNames[emptyIndex] = playerName;
            transaction.update(roomRef, { playerNames: currentNames });
        });

        return currentNames;
    } catch (error) {
        console.error("Error joining room:", error);
        throw error;
    }
};

// Better approach: Update the entire game state from the host, 
// and clients just listen. Clients can send actions to update specific things.
// For this simple calculator, maybe allow anyone to update anything? 
// Yes, for "friends playing together", shared control is fine.

export const updateRoomState = async (roomId, data) => {
    try {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId);
        await setDoc(roomRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("Error updating room:", error);
    }
};

export const subscribeToRoom = (roomId, callback) => {
    return onSnapshot(doc(db, ROOMS_COLLECTION, roomId), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
};

// User Preferences / Settings (e.g. last player names)
const SETTINGS_COLLECTION = 'user_settings';

export const saveLastPlayerNames = async (names) => {
    try {
        const userId = getUserId();
        await setDoc(doc(db, SETTINGS_COLLECTION, userId), {
            lastPlayerNames: names,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error("Error saving last player names:", error);
    }
};

export const getLastPlayerNames = async () => {
    try {
        const userId = getUserId();
        const docRef = doc(db, SETTINGS_COLLECTION, userId);
        // Better:
        const d = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
        
        if (d.exists()) {
            return d.data().lastPlayerNames || null;
        }
        return null;
    } catch (error) {
        if (error.code !== 'unavailable' && !error.message?.includes('offline')) {
            console.error("Error getting last player names:", error);
        }
        return null;
    }
};

// Active Game Collection (for real-time persistence)
const GAMES_COLLECTION = 'active_games';

export const saveActiveGame = async (gameData) => {
    try {
        const userId = getUserId();
        // We use userId as docId for simplicity to have one active game per device/user
        await setDoc(doc(db, GAMES_COLLECTION, userId), {
            ...gameData,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving active game:", error);
    }
};

export const subscribeToActiveGame = (callback) => {
    const userId = getUserId();
    return onSnapshot(doc(db, GAMES_COLLECTION, userId), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
};

export const clearActiveGame = async () => {
    try {
        const userId = getUserId();
        // Instead of delete, just set empty/null state or specific flag
        await setDoc(doc(db, GAMES_COLLECTION, userId), {
            active: false,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error clearing active game:", error);
    }
};
