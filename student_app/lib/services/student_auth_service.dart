import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Student Authentication Service
/// 
/// Handles:
/// - Login with phone + password
/// - First login flow (PIN -> force password change)
/// - Password change
/// - Session management
/// 
/// Email format: stu_{normalizedPhone}@remas.local
class StudentAuthService {
  FirebaseAuth? get _auth {
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseFirestore? get _db {
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseFunctions? get _functions {
    try {
      return FirebaseFunctions.instance;
    } catch (_) {
      return null;
    }
  }

  /// Auth state stream
  Stream<User?> get authStateChanges {
    final auth = _auth;
    if (auth == null) return Stream.value(null);
    try {
      return auth.authStateChanges();
    } catch (_) {
      return Stream.value(null);
    }
  }

  /// Current user
  User? get currentUser {
    final auth = _auth;
    if (auth == null) return null;
    try {
      return auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  /// Convert Arabic-Indic digits to Western digits (0-9)
  static String convertArabicDigits(String input) {
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    String res = input;
    for (int i = 0; i < arabic.length; i++) {
      res = res.replaceAll(arabic[i], english[i]);
    }
    return res;
  }

  /// Normalize Egyptian phone to E.164
  String normalizePhone(String input) {
    final converted = convertArabicDigits(input);
    String cleaned = converted.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleaned.startsWith('+20')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('01')) {
      cleaned = '2$cleaned';
    }
    if (cleaned.startsWith('201') && cleaned.length == 12) {
      return '+$cleaned';
    }
    return converted.trim();
  }

  /// Convert phone to email for Firebase Auth
  String phoneToEmail(String normalizedPhone) {
    return 'stu_${normalizedPhone.replaceAll('+', '')}@remas.local';
  }

  /// Login with phone + password
  /// Returns StudentLoginResult with mustChangePassword flag
  /// Throws StudentAuthException for errors
  Future<StudentLoginResult> loginWithPhoneAndPassword({
    required String phone,
    required String password,
  }) async {
    final auth = _auth;
    if (auth == null) {
      throw StudentAuthException('AUTH_UNAVAILABLE', 'خدمة المصادقة غير متوفرة');
    }

    final normalizedPhone = normalizePhone(phone);
    if (!RegExp(r'^\+201[0125]\d{8}$').hasMatch(normalizedPhone)) {
      throw StudentAuthException('INVALID_PHONE', 'رقم الهاتف غير صحيح');
    }

    final email = phoneToEmail(normalizedPhone);
    final cleanPassword = convertArabicDigits(password.trim());

    try {
      final credential = await auth.signInWithEmailAndPassword(
        email: email,
        password: cleanPassword,
      );

      if (credential.user == null) {
        throw StudentAuthException('LOGIN_FAILED', 'فشل تسجيل الدخول');
      }

      // Get custom claims
      final tokenResult = await credential.user!.getIdTokenResult();
      final claims = tokenResult.claims;
      final role = claims?['role'] as String?;

      // Verify this is a student account (by custom claim or canonical student email format)
      final isStudentEmail = email.startsWith('stu_') && email.endsWith('@remas.local');
      if (role != 'student' && !isStudentEmail) {
        await auth.signOut();
        throw StudentAuthException('NOT_STUDENT', 'هذا الحساب ليس حساب طالب');
      }

      // Ask the trusted backend for the AUTHORITATIVE account status. Claims
      // alone are not enough: they can lag behind a center reset, and the
      // Worker checks the Firestore status, not the claim.
      String? status = await getSelfStatus();
      status ??= claims?['status'] as String?;

      // Find the student document in Firestore to resolve status & institutionId, and auto-link authUid
      String? resolvedInstitutionId = claims?['institutionId'] as String?;
      bool mustChangePassword = false;
      try {
        final db = _db;
        if (db != null) {
          QueryDocumentSnapshot<Map<String, dynamic>>? studentDoc;
          // 1. Try finding by authUid
          final snapAuth = await db
              .collectionGroup('students')
              .where('authUid', isEqualTo: credential.user!.uid)
              .limit(1)
              .get();
          if (snapAuth.docs.isNotEmpty) {
            studentDoc = snapAuth.docs.first;
          } else {
            // 2. Fallback: find by normalizedPhone
            final snapPhone = await db
                .collectionGroup('students')
                .where('normalizedPhone', isEqualTo: normalizedPhone)
                .limit(1)
                .get();
            if (snapPhone.docs.isNotEmpty) {
              studentDoc = snapPhone.docs.first;
            } else {
              // 3. Fallback: find by phone
              final snapRawPhone = await db
                  .collectionGroup('students')
                  .where('phone', isEqualTo: phone.trim())
                  .limit(1)
                  .get();
              if (snapRawPhone.docs.isNotEmpty) {
                studentDoc = snapRawPhone.docs.first;
              }
            }
          }

          if (studentDoc != null) {
            final sData = studentDoc.data();
            status ??= sData['status'] as String?;
            resolvedInstitutionId ??= sData['institutionId'] as String?;

            // Self-link authUid & authEmail if not matching or missing
            if (sData['authUid'] != credential.user!.uid) {
              try {
                await studentDoc.reference.update({
                  'authUid': credential.user!.uid,
                  'authEmail': email,
                  'updatedAt': FieldValue.serverTimestamp(),
                });
              } catch (_) {}
            }

            final isTempPassSet = sData['tempPassword'] != null && sData['tempPassword'].toString().isNotEmpty;
            final initialPinNotChanged = sData['initialPinChanged'] == false;
            final forcedFlag = sData['mustChangePassword'] == true;
            if (status == 'MUST_CHANGE_PASSWORD' || forcedFlag || isTempPassSet || initialPinNotChanged) {
              mustChangePassword = true;
            }
          }
        }
      } catch (_) {}

      // Fallback check from cloud function or claims if Firestore doc not yet found
      if (status == 'MUST_CHANGE_PASSWORD') {
        mustChangePassword = true;
      }
      status ??= 'ACTIVE';

      // Only reject if explicitly INACTIVE or ARCHIVED
      if (status == 'INACTIVE' || status == 'ARCHIVED') {
        await auth.signOut();
        throw StudentAuthException('ACCOUNT_INACTIVE', 'هذا الحساب غير نشط. تواصل مع إدارة السنتر');
      }

      return StudentLoginResult(
        success: true,
        uid: credential.user!.uid,
        mustChangePassword: mustChangePassword,
        institutionId: resolvedInstitutionId,
      );
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
        case 'wrong-password':
        case 'invalid-credential':
          throw StudentAuthException('INVALID_CREDENTIALS', 'رقم الهاتف أو كلمة المرور غير صحيحة');
        case 'user-disabled':
          throw StudentAuthException('ACCOUNT_DISABLED', 'تم تعطيل هذا الحساب. تواصل مع إدارة السنتر');
        case 'too-many-requests':
          throw StudentAuthException('TOO_MANY_ATTEMPTS', 'عدد محاولات كبير جدًا. يرجى المحاولة لاحقًا');
        case 'invalid-email':
          throw StudentAuthException('INVALID_PHONE', 'رقم الهاتف غير صحيح');
        default:
          throw StudentAuthException('LOGIN_ERROR', 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى');
      }
    } on StudentAuthException {
      rethrow;
    } catch (e) {
      throw StudentAuthException('LOGIN_ERROR', 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى');
    }
  }

  /// Check if the student must change password
  Future<bool> checkMustChangePassword(String uid) async {
    try {
      final db = _db;
      if (db != null) {
        QuerySnapshot<Map<String, dynamic>> snap = await db
            .collectionGroup('students')
            .where('authUid', isEqualTo: uid)
            .limit(1)
            .get();

        if (snap.docs.isEmpty) {
          final email = currentUser?.email ?? '';
          if (email.startsWith('stu_') && email.endsWith('@remas.local')) {
            final raw = email.replaceFirst('stu_', '').replaceFirst('@remas.local', '');
            final phones = ['+$raw', raw, '0${raw.replaceFirst(RegExp(r'^2'), '')}'];
            for (final p in phones) {
              final s = await db
                  .collectionGroup('students')
                  .where('normalizedPhone', isEqualTo: p)
                  .limit(1)
                  .get();
              if (s.docs.isNotEmpty) {
                snap = s;
                break;
              }
            }
          }
        }

        if (snap.docs.isNotEmpty) {
          final sData = snap.docs.first.data();
          final status = sData['status'] as String?;
          final isTempPassSet = sData['tempPassword'] != null && sData['tempPassword'].toString().isNotEmpty;
          final initialPinNotChanged = sData['initialPinChanged'] == false;
          final forcedFlag = sData['mustChangePassword'] == true;
          return status == 'MUST_CHANGE_PASSWORD' || forcedFlag || isTempPassSet || initialPinNotChanged;
        }
      }
    } catch (_) {}
    return false;
  }

  /// Fetch the signed-in student's authoritative account status from the
  /// trusted backend (Cloud Function getStudentSelfStatus). Requires an active
  /// Firebase session; the backend resolves the student from the token's uid,
  /// so the client cannot request anyone else's status.
  ///
  /// Returns the status string, or null if the lookup is unavailable (the
  /// caller then falls back to the claims value).
  Future<String?> getSelfStatus() async {
    final functions = _functions;
    if (functions == null) return null;

    try {
      final callable = functions.httpsCallable('getStudentSelfStatus');
      final result = await callable.call(<String, dynamic>{});
      final data = result.data;
      if (data is Map && data['status'] is String) {
        return data['status'] as String;
      }
      return null;
    } on FirebaseFunctionsException catch (e) {
      // NOT_LINKED means the auth user has no student record -> treat as
      // unknown so the caller signs out via the generic path.
      if (e.code == 'not-found') return 'UNKNOWN';
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Complete first login - change password
  Future<void> completeFirstLogin({
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (newPassword != confirmPassword) {
      throw StudentAuthException('PASSWORD_MISMATCH', 'كلمتا المرور غير متطابقتين');
    }

    if (newPassword.length < 6) {
      throw StudentAuthException('PASSWORD_TOO_SHORT', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    final user = currentUser;
    if (user == null) {
      throw StudentAuthException('UNAUTHENTICATED', 'يجب تسجيل الدخول أولًا');
    }

    try {
      await user.updatePassword(newPassword);
    } catch (e) {
      throw StudentAuthException('CHANGE_FAILED', 'حدث خطأ أثناء تغيير كلمة المرور');
    }

    // Update Firestore student document to ACTIVE and clear temporary password
    try {
      final db = _db;
      if (db != null) {
        final snap = await db
            .collectionGroup('students')
            .where('authUid', isEqualTo: user.uid)
            .limit(1)
            .get();
        if (snap.docs.isNotEmpty) {
          await snap.docs.first.reference.update({
            'status': 'ACTIVE',
            'mustChangePassword': false,
            'initialPinChanged': true,
            'tempPassword': FieldValue.delete(),
            'passwordChangedAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
            'updatedBy': user.uid,
          });
        }
      }
    } catch (_) {}

    try {
      await user.getIdToken(true);
    } catch (_) {
      // Non-fatal
    }
  }

  /// Extract the stable 'CODE: ...' prefix from a callable error message, else
  /// fall back to the Firebase Functions error code.
  static String _serverErrorCode(FirebaseFunctionsException e) {
    final msg = e.message ?? '';
    final idx = msg.indexOf(':');
    if (idx > 0) {
      final prefix = msg.substring(0, idx).trim();
      // Server prefixes are SCREAMING_SNAKE_CASE identifiers.
      if (RegExp(r'^[A-Z][A-Z0-9_]+$').hasMatch(prefix)) {
        return prefix;
      }
    }
    return e.code;
  }

  /// Change password (for logged-in ACTIVE students).
  ///
  /// Ownership proof: we first RE-AUTHENTICATE with the current password via
  /// Firebase Auth (server-side verification, and it bumps auth_time). The
  /// Cloud Function requires that fresh re-auth before accepting the change,
  /// so a hijacked session alone can't set a new password.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (newPassword != confirmPassword) {
      throw StudentAuthException('PASSWORD_MISMATCH', 'كلمتا المرور غير متطابقتين');
    }

    if (newPassword.length < 6) {
      throw StudentAuthException('PASSWORD_TOO_SHORT', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    final auth = _auth;
    final user = currentUser;
    if (auth == null || user == null) {
      throw StudentAuthException('UNAUTHENTICATED', 'يجب تسجيل الدخول أولاً');
    }

    // Re-authenticate with the current password (verified by Firebase Auth).
    final email = user.email;
    if (email == null || email.isEmpty) {
      throw StudentAuthException('ACCOUNT_ERROR', 'تعذر التحقق من الحساب. تواصل مع إدارة السنتر');
    }
    try {
      final credential = EmailAuthProvider.credential(
        email: email,
        password: currentPassword,
      );
      await user.reauthenticateWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      if (e.code == 'wrong-password' || e.code == 'invalid-credential') {
        throw StudentAuthException('WRONG_CURRENT_PASSWORD', 'كلمة المرور الحالية غير صحيحة');
      }
      if (e.code == 'too-many-requests') {
        throw StudentAuthException('TOO_MANY_ATTEMPTS', 'عدد محاولات كبير جدًا. يرجى المحاولة لاحقًا');
      }
      throw StudentAuthException('REAUTH_FAILED', 'تعذر التحقق من كلمة المرور الحالية');
    }

    final functions = _functions;
    if (functions == null) {
      throw StudentAuthException('FUNCTIONS_UNAVAILABLE', 'خدمة المصادقة غير متوفرة');
    }

    try {
      final callable = functions.httpsCallable('changeStudentPassword');
      final result = await callable.call({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      });

      if (result.data['success'] != true) {
        throw StudentAuthException('CHANGE_FAILED', result.data['message'] ?? 'فشل تغيير كلمة المرور');
      }
    } on FirebaseFunctionsException catch (e) {
      throw StudentAuthException(_serverErrorCode(e), e.message ?? 'فشل تغيير كلمة المرور');
    } catch (e) {
      throw StudentAuthException('CHANGE_FAILED', 'حدث خطأ أثناء تغيير كلمة المرور');
    }
  }

  /// Sign out
  Future<void> signOut() async {
    final auth = _auth;
    if (auth == null) return;
    await auth.signOut();
  }

  /// Get ID token for API calls
  Future<String?> getIdToken() async {
    final user = currentUser;
    if (user == null) return null;
    try {
      return await user.getIdToken();
    } catch (_) {
      return null;
    }
  }

  /// Get custom claims
  Future<Map<String, dynamic>?> getIdTokenClaims() async {
    final user = currentUser;
    if (user == null) return null;
    try {
      final tokenResult = await user.getIdTokenResult();
      return tokenResult.claims;
    } catch (_) {
      return null;
    }
  }
}

/// Login result
class StudentLoginResult {
  final bool success;
  final String uid;
  final bool mustChangePassword;
  final String? institutionId;

  StudentLoginResult({
    required this.success,
    required this.uid,
    required this.mustChangePassword,
    this.institutionId,
  });
}

/// Auth exception
class StudentAuthException implements Exception {
  final String code;
  final String message;

  StudentAuthException(this.code, this.message);

  @override
  String toString() => '$code: $message';
}
