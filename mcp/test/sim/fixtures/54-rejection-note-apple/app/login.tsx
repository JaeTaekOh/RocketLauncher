import auth from '@react-native-firebase/auth';
export const login = (e, p) => auth().signInWithEmailAndPassword(e, p);
