import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
export class AuthService {
  login(e: string, p: string) { return signInWithEmailAndPassword(getAuth(), e, p); }
}
