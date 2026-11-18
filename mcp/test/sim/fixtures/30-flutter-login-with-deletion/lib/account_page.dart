import 'package:firebase_auth/firebase_auth.dart';
class AccountPage { Future<void> deleteAccount() async { await FirebaseAuth.instance.currentUser?.delete(); } String get label => 'Delete account'; }
