import * as faceapi from 'face-api.js';
import { v4 as uuidv4 } from 'uuid';
import { SavedFace } from '../storage/types';

export const MASTER_PASSCODE = "0000";

export const analyzeFace = async (base64Image: string): Promise<SavedFace> => {
  const img = await faceapi.fetchImage(`data:image/jpeg;base64,${base64Image}`);
  const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error("No face detected");
  }

  return {
    id: uuidv4(),
    label: `User-${Date.now().toString().slice(-4)}`,
    descriptor: detection.descriptor,
    createdAt: Date.now(),
    image: base64Image
  };
};
