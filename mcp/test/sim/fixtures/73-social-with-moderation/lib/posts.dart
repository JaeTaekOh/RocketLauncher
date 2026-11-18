import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
Future<void> reportPost(String id) => FirebaseFirestore.instance.collection('reports').add({'post': id});
Future<void> blockUser(String uid) => FirebaseFirestore.instance.collection('blocks').add({'uid': uid});
Future<void> deleteAccount() => FirebaseAuth.instance.currentUser!.delete();
