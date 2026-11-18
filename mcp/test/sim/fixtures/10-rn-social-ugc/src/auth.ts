import auth from '@react-native-firebase/auth';
export const signIn = (e: string, p: string) => auth().signInWithEmailAndPassword(e, p);
