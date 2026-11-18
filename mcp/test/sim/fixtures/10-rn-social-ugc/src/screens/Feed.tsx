import firestore from '@react-native-firebase/firestore';
export async function post(text: string) { await firestore().collection('posts').add({ text, createdAt: Date.now() }); }
export const comments = (id: string) => firestore().collection('posts').doc(id).collection('comments');
