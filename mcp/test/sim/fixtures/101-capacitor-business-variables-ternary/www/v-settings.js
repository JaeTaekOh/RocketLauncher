import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
export async function deleteAccount() { if (!confirm('계정을 삭제할까요? Delete account')) return; await fetch('/api/account', { method: 'DELETE' }); await FirebaseAuthentication.signOut(); }
export const signIn = () => FirebaseAuthentication.signInWithGoogle();
