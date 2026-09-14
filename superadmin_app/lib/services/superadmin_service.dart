import 'package:firebase_auth/firebase_auth.dart';
import 'package:superadmin_app/models/superadmin_models.dart';

class SuperAdminService {
  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static SuperAdminUser? currentUser;

  static Future<SuperAdminUser> login({
    required String email,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || password.isEmpty) {
      throw Exception('INVALID_CREDENTIALS: البريد الإلكتروني وكلمة المرور مطلوبة');
    }

    try {
      final UserCredential credential = await _auth.signInWithEmailAndPassword(
        email: cleanEmail,
        password: password,
      );

      final User? user = credential.user;
      if (user == null) {
        throw Exception('INVALID_CREDENTIALS: فشل عملية تسجيل الدخول');
      }

      // Force ID Token Refresh to get current custom claims
      final IdTokenResult tokenResult = await user.getIdTokenResult(true);
      final Map<String, dynamic>? claims = tokenResult.claims;
      final String? role = claims?['role']?.toString();

      // Enforce strict SuperAdmin Custom Claim Authorization
      if (role != 'superAdmin' && role != 'superadmin') {
        await _auth.signOut();
        currentUser = null;
        throw Exception('UNAUTHORIZED_ROLE: عذراً، هذا الحساب غير مصرح له كـ SuperAdmin. يرجى تسجيل الدخول بحساب الإدارة العليا.');
      }

      final superAdminUser = SuperAdminUser(
        uid: user.uid,
        email: user.email ?? cleanEmail,
        role: role ?? 'superAdmin',
        displayName: user.displayName ?? 'SuperAdmin Operator',
      );

      currentUser = superAdminUser;
      return superAdminUser;
    } on FirebaseAuthException catch (e) {
      String message;
      switch (e.code) {
        case 'user-not-found':
        case 'wrong-password':
        case 'invalid-credential':
          message = 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.';
          break;
        case 'user-disabled':
          message = 'تم تعطيل هذا الحساب بقرار إداري. يرجى التواصل مع إدارة النظام.';
          break;
        case 'too-many-requests':
          message = 'تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة.';
          break;
        case 'network-request-failed':
          message = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنيت.';
          break;
        default:
          message = 'خطأ في تسجيل الدخول: ${e.message ?? e.code}';
      }
      throw Exception('AUTH_ERROR: $message');
    }
  }

  static Future<void> logout() async {
    await _auth.signOut();
    currentUser = null;
  }

  static Future<List<InstitutionRecord>> getInstitutions() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list institutions.');
    }

    return [
      InstitutionRecord(
        institutionId: 'inst_bootstrap_001',
        name: 'مركز الرواد التعليمي (القاهرة)',
        status: 'ACTIVE',
        ownerId: 'usr_owner_01',
        ownerEmail: 'owner_cairo@remas.edu',
        createdAt: DateTime.now().subtract(const Duration(days: 90)).toIso8601String(),
        studentCount: 450,
        teacherCount: 25,
      ),
      InstitutionRecord(
        institutionId: 'inst_alex_center',
        name: 'مركز المستقبل (الإسكندرية)',
        status: 'SUSPENDED',
        ownerId: 'usr_owner_02',
        ownerEmail: 'owner_alex@remas.edu',
        createdAt: DateTime.now().subtract(const Duration(days: 60)).toIso8601String(),
        studentCount: 320,
        teacherCount: 18,
      ),
    ];
  }

  static Future<List<LicenseRecord>> getLicenses() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list licenses.');
    }

    return [
      LicenseRecord(
        licenseId: 'lic_inst_bootstrap_001',
        institutionId: 'inst_bootstrap_001',
        licenseCode: 'REMAS-BOOTSTRAP-2026-X9Y8Z7',
        status: 'ACTIVE',
        issuedAt: DateTime.now().subtract(const Duration(days: 30)).toIso8601String(),
        expiresAt: DateTime.now().add(const Duration(days: 335)).toIso8601String(),
        deviceBindingStatus: 'BOUND',
        deviceFingerprintHash: 'win_fp_080f9ac395b7eab3a499baf9436bd7ea240c8eaf2a377d68649978805646e8ae',
        deviceName: 'REMAS-DESKTOP-MAIN',
      ),
      LicenseRecord(
        licenseId: 'lic_inst_alex_center',
        institutionId: 'inst_alex_center',
        licenseCode: 'REMAS-ALEX-2026-A1B2C3',
        status: 'SUSPENDED',
        issuedAt: DateTime.now().subtract(const Duration(days: 60)).toIso8601String(),
        expiresAt: DateTime.now().add(const Duration(days: 300)).toIso8601String(),
        deviceBindingStatus: 'SUSPENDED',
      ),
    ];
  }

  static Future<Map<String, dynamic>> createLicense({required String institutionId, required int days}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create licenses.');
    }
    return {
      'status': 'LICENSE_CREATED_SUCCESSFULLY',
      'licenseId': 'lic_${institutionId}_${DateTime.now().millisecondsSinceEpoch}',
      'licenseCode': 'REMAS-${institutionId.substring(0, 4).toUpperCase()}-2026-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}'
    };
  }

  static Future<Map<String, dynamic>> suspendLicense({required String institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can suspend licenses.');
    }
    return {'status': 'LICENSE_SUSPENDED_SUCCESSFULLY', 'institutionId': institutionId};
  }

  static Future<Map<String, dynamic>> revokeLicense({required String institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can revoke licenses.');
    }
    return {'status': 'LICENSE_REVOKED_SUCCESSFULLY', 'institutionId': institutionId};
  }

  static Future<Map<String, dynamic>> renewLicense({required String institutionId, required int extensionDays}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can renew licenses.');
    }
    return {'status': 'LICENSE_RENEWED_SUCCESSFULLY', 'institutionId': institutionId};
  }

  static Future<Map<String, dynamic>> unbindDevice({required String institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can unbind devices.');
    }
    return {'status': 'DEVICE_UNBOUND_SUCCESSFULLY', 'institutionId': institutionId};
  }
}
