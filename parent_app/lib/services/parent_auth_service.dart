import 'package:flutter/foundation.dart';

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
  ParentAuthStatus _status = ParentAuthStatus.unauthenticated;
  ParentAuthUser? _currentUser;
  String? _errorMessage;

  ParentAuthStatus get status => _status;
  ParentAuthUser? get currentUser => _currentUser;
  String? get errorMessage => _errorMessage;

  Future<bool> login(String email, String password) async {
    _status = ParentAuthStatus.initializing;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));

    // Role check: Only role == 'parent' (or 'superAdmin') allowed
    if (email.contains('student')) {
      _status = ParentAuthStatus.error;
      _errorMessage = 'UNAUTHORIZED_ROLE: حساب الطالب لا يمكنه الدخول إلى تطبيق ولي الأمر.';
      notifyListeners();
      return false;
    }

    if (email.contains('teacher')) {
      _status = ParentAuthStatus.error;
      _errorMessage = 'UNAUTHORIZED_ROLE: حساب المعلم لا يمكنه الدخول إلى تطبيق ولي الأمر.';
      notifyListeners();
      return false;
    }

    _currentUser = ParentAuthUser(
      uid: 'parent_dev_101',
      email: email,
      role: 'parent',
      institutionId: 'inst_dev_center',
      fullName: 'أحمد علي (ولي أمر)',
    );

    _status = ParentAuthStatus.authenticated;
    _errorMessage = null;
    notifyListeners();
    return true;
  }

  void logout() {
    _currentUser = null;
    _status = ParentAuthStatus.unauthenticated;
    _errorMessage = null;
    notifyListeners();
  }
}
