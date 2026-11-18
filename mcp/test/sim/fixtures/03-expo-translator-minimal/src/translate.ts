import { CameraView } from 'expo-camera';
export async function translate(text: string, to: string) { return fetch('https://api.polyglot.app/translate', { method: 'POST', body: JSON.stringify({ text, to }) }); }
