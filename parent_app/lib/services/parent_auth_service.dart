import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';

enum ParentAuthStatus { initializing, authenticated, unauthenticated, error }

class ParentAuthUser {
  final String uid;
  final String email;
  final String role;
  final String institutionId;
  final String fullName;

  ParentAuthUser({
    required this.uid,
    required this.email,
    required this.role,
    required this.institutionId,
    required this.fullName,
  });
}

class ParentAuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  ParentAuthStatus _status = ParentAuthStatus.unauthenticated;
  ParentAuthUser? _currentUser;
  String? _errorMessage;

  ParentAuthStatus get status => _status;
  ParentAuthUser? get currentUser => _currentUser;
  String? get errorMessage => _errorMessage;

  Future<bool> login(String email, String password) async {
    _status = ParentAuthStatus.initializing;
    notifyListeners();

    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || password.isEmpty) {
      _status = ParentAuthStatus.error;
      _errorMessage = 'INVALID_CREDENTIALS: البريد الإلكتروني وكلمة المرور مطلوبة.';
      notifyListeners();
      return false;
    }

    try {
      final UserCredential credential = await _auth.signInWithEmailAndPassword(
        email: cleanEmail,
        password: password,
      );

      final User? user = credential.user;
      if (user == null) {
        _status = ParentAuthStatus.error;
        _errorMessage = 'INVALID_CREDENTIALS: فشل تسجيل الدخول.';
        notifyListeners();
        return false;
      }

      final IdTokenResult tokenResult = await user.getIdTokenResult(true);
      final String? role = tokenResult.claims?['role']?.toString();
      final String? institutionId = tokenResult.claims?['institutionId']?.toString();

      if (role != 'parent' && role != 'superAdmin' && role != 'superadmin') {
        await _auth.signOut();
        _status = ParentAuthStatus.error;
        _errorMessage = 'UNAUTHORIZED_ROLE: هذا الحساب غير مصرح له كولي أمر.';
        notifyListeners();
        return false;
      }

      _currentUser = ParentAuthUser(
        uid: user.uid,
        email: user.email ?? cleanEmail,
        role: role ?? 'parent',
        institutionId: institutionId ?? 'inst_dev_center',
        fullName: user.displayName ?? 'ولي أمر الطالب',
      );

      _status = ParentAuthStatus.authenticated;
      _errorMessage = null;
      notifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      _status = ParentAuthStatus.error;
      if (e.code == 'user-not-found' || e.code == 'wrong-password' || e.code == 'invalid-credential') {
        _errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (e.code == 'network-request-failed') {
        _errorMessage = 'تعذر الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت.';
      } else {
        _errorMessage = 'خطأ في تسجيل الدخول: ${e.message ?? e.code}';
      }
      notifyListeners();
      return false;
    } catch (e) {
      _status = ParentAuthStatus.error;
      _errorMessage = 'خطأ غير متوقع: ${e.toString()}';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _auth.signOut();
    _currentUser = null;
    _status = ParentAuthStatus.unauthenticated;
    _errorMessage = null;
    notifyListeners();
  }
}
