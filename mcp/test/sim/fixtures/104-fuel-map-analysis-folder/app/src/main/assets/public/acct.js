// Account menu: sign in with Google (optional) and delete the account.
async function runDelete(user) { if (!confirm('내 계정 삭제')) return; await firebase.auth().currentUser.delete(); }
function signIn() { return FirebaseAuthentication.signInWithGoogle(); }
navigator.geolocation.getCurrentPosition(function () {});
