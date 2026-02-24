import { v4 as uuidv4 } from 'uuid';

export const generateUUID = () => uuidv4();

export const IRISSounds = {
  play: (type: 'click' | 'error' | 'boot' | 'success') => {
    // Placeholder for sound effects
    // In a real app, we would use AudioContext or HTMLAudioElement
    console.log(`[SOUND] Playing ${type}`);
  }
};
