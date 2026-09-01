import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  FirebaseAuth? get _auth {
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  // Stream of auth state changes
  Stream<User?> get authStateChanges {
    final auth = _auth;
    if (auth == null) {
      return Stream.value(null);
    }
    try {
      return auth.authStateChanges();
    } catch (_) {
      return Stream.value(null);
    }
  }

  // Current authenticated user
  User? get currentUser {
    final auth = _auth;
    if (auth == null) return null;
    try {
      return auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  // Sign in with email and password
  Future<UserCredential?> signInWithEmailAndPassword(String email, String password) async {
    final auth = _auth;
    if (auth == null) return null;
    return await auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  // Sign out
  Future<void> signOut() async {
    final auth = _auth;
    if (auth == null) return;
    await auth.signOut();
  }

  // Send password reset email
  Future<void> sendPasswordResetEmail(String email) async {
    final auth = _auth;
    if (auth == null) return;
    await auth.sendPasswordResetEmail(email: email);
  }

  // Fetch token custom claims (role, institutionId)
  Future<Map<String, dynamic>?> getIdTokenClaims() async {
    final user = currentUser;
    if (user != null) {
      try {
        final tokenResult = await user.getIdTokenResult();
        return tokenResult.claims;
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}
