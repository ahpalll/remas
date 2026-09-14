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

  // Verify Phone Number (SMS OTP)
  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required void Function(PhoneAuthCredential) verificationCompleted,
    required void Function(FirebaseAuthException) verificationFailed,
    required void Function(String verificationId, int? resendToken) codeSent,
    required void Function(String verificationId) codeAutoRetrievalTimeout,
  }) async {
    final auth = _auth;
    if (auth == null) {
      verificationFailed(FirebaseAuthException(
        code: 'auth-not-available',
        message: 'خدمة التحقق غير متوفرة في بيئة العمل الحالية',
      ));
      return;
    }
    await auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: verificationCompleted,
      verificationFailed: verificationFailed,
      codeSent: codeSent,
      codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
    );
  }

  // Sign in with Phone Auth Credential (Verification ID + SMS Code)
  Future<UserCredential?> signInWithPhoneCredential(String verificationId, String smsCode) async {
    final auth = _auth;
    if (auth == null) return null;
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode,
    );
    return await auth.signInWithCredential(credential);
  }

  // Sign in with email and password (Legacy / Admin fallback)
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
