package com.sim.snapfeed
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.auth.FirebaseAuth
fun post(text: String) { FirebaseFirestore.getInstance().collection("posts").add(mapOf("text" to text)) }
fun out() { FirebaseAuth.getInstance().currentUser?.delete() }
