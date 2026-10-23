import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:superadmin_app/firebase_options.dart';
import 'package:superadmin_app/models/superadmin_models.dart';

/// Append-only audit trail for SuperAdmin governance actions.
///
/// Writes top-level `auditLogs` docs (the SAME collection the audit screen
/// reads, ordered by `createdAt`). Never throws: an audit failure is
/// reported via [AuditOutcome] so it can never mask or fake the underlying
/// operation result. Actor identity comes from the live SuperAdmin session.
class AuditOutcome {
  final bool written;
  final String? warning;
  const AuditOutcome({required this.written, this.warning});
}

class AuditService {
  static Future<AuditOutcome> record({
    required String action,
    required String institutionId,
    String targetType = '',
    String targetId = '',
    String reason = '',
    Map<String, dynamic> details = const {},
  }) async {
    final user = SuperAdminService.currentUser;
    try {
      if (user == null || !user.isSuperAdmin) {
        return const AuditOutcome(
            written: false,
            warning: 'AUDIT_SKIPPED: لا توجد جلسة SuperAdmin نشطة وقت الكتابة.');
      }
      await FirebaseFirestore.instance.collection('auditLogs').add({
        'action': action,
        'actorUid': user.uid,
        'actorEmail': user.email,
        'institutionId': institutionId,
        'targetType': targetType,
        'targetId': targetId,
        'reason': reason,
        'details': details,
        'createdAt': DateTime.now().toIso8601String(),
      });
      return const AuditOutcome(written: true);
    } catch (e) {
      debugPrint('AUDIT_WRITE_FAILED: $action $targetId: $e');
      return const AuditOutcome(
          written: false,
          warning:
              'AUDIT_WRITE_FAILED: تمت العملية لكن تعذّر حفظ سجل التدقيق — راجع سجل النظام.');
    }
  }
}

class SuperAdminService {
  static FirebaseAuth get _auth => FirebaseAuth.instance;
  static FirebaseFirestore get _db => FirebaseFirestore.instance;
  static SuperAdminUser? currentUser;

  /// Testing seam ONLY: lets unit tests exercise input validation
  /// (which runs after the SuperAdmin guard) without a backend.
  /// Production auth still flows exclusively through [login]/[logout];
  /// this setter is never called by app code.
  @visibleForTesting
  static void debugSetCurrentUserForTesting(SuperAdminUser? user) {
    currentUser = user;
  }

  static String generateTemporaryPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#\$%';
    final rnd = math.Random.secure();
    final buffer = StringBuffer('Owner_');
    for (int i = 0; i < 10; i++) {
      buffer.write(chars[rnd.nextInt(chars.length)]);
    }
    return buffer.toString();
  }

  static Future<String> provisionOwnerAuthAccount({
    required String ownerEmail,
    required String tempPassword,
  }) async {
    final apiKey = DefaultFirebaseOptions.currentPlatform.apiKey;
    final client = HttpClient();
    try {
      final uri = Uri.parse('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey');
      final req = await client.postUrl(uri);
      req.headers.set('content-type', 'application/json');
      final payload = jsonEncode({
        'email': ownerEmail.trim().toLowerCase(),
        'password': tempPassword,
        'returnSecureToken': true,
      });
      req.write(payload);
      final res = await req.close();
      final bodyStr = await res.transform(utf8.decoder).join();
      final parsed = jsonDecode(bodyStr) as Map<String, dynamic>;
      if (res.statusCode == 200 && parsed.containsKey('localId')) {
        return parsed['localId'] as String;
      } else {
        final err = parsed['error']?['message'] ?? 'UNKNOWN_AUTH_ERROR';
        throw Exception('OWNER_AUTH_PROVISIONING_FAILED [${res.statusCode}]: $err');
      }
    } finally {
      client.close();
    }
  }

  static Future<void> createOwnerUserProfile({
    required String ownerUid,
    required String ownerEmail,
    required String ownerName,
    required String ownerPhone,
    required String institutionId,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create owner profiles.');
    }
    final nowISO = DateTime.now().toIso8601String();

    // Global user profile in /users/{uid}
    await _db.collection('users').doc(ownerUid).set({
      'uid': ownerUid,
      'email': ownerEmail.trim().toLowerCase(),
      'displayName': ownerName.trim().isEmpty ? 'مالك المركز' : ownerName.trim(),
      'phone': ownerPhone.trim(),
      'role': 'institutionOwner',
      'status': 'ACTIVE',
      'institutionId': institutionId,
      'institutionIds': [institutionId],
      'mustChangePassword': true,
      'createdAt': nowISO,
      'updatedAt': nowISO,
    });

    // Tenant user profile in /institutions/{institutionId}/users/{uid}
    await _db.collection('institutions').doc(institutionId).collection('users').doc(ownerUid).set({
      'uid': ownerUid,
      'email': ownerEmail.trim().toLowerCase(),
      'fullName': ownerName.trim().isEmpty ? 'مالك المركز' : ownerName.trim(),
      'phone': ownerPhone.trim(),
      'role': 'institutionOwner',
      'institutionId': institutionId,
      'status': 'ACTIVE',
      'createdAt': nowISO,
      'updatedAt': nowISO,
    });

    // Update institution document ownerId reference using transaction
    // to ensure atomicity with user profile creation
    await _db.runTransaction((transaction) async {
      final instRef = _db.collection('institutions').doc(institutionId);
      final instSnap = await transaction.get(instRef);
      if (!instSnap.exists) {
        throw Exception('INSTITUTION_NOT_FOUND: المؤسسة غير موجودة');
      }
      final instData = instSnap.data()!;
      // Only update ownerId if it's still PENDING_OWNER (not yet claimed)
      // or if it's already set to this owner (idempotent re-run)
      if (instData['ownerId'] == 'PENDING_OWNER' || instData['ownerId'] == ownerUid) {
        transaction.update(instRef, {
          'ownerId': ownerUid,
          'updatedAt': nowISO,
        });
      } else {
        throw Exception('OWNER_ALREADY_CLAIMED: المؤسسة مرتبطة بمالك آخر');
      }
    });
  }

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
      final bool isSaClaim = claims?['superAdmin'] == true || claims?['superadmin'] == true;
      final bool isSaRole = role == 'superAdmin' || role == 'superadmin';

      // Enforce strict SuperAdmin Custom Claim Authorization
      if (!isSaRole && !isSaClaim) {
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
    } catch (e) {
      rethrow;
    }
  }

  static Future<void> logout() async {
    try {
      await _auth.signOut();
    } catch (_) {}
    currentUser = null;
  }

  static Future<List<InstitutionRecord>> getInstitutions() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list institutions.');
    }

    try {
      final querySnap = await _db.collection('institutions').get();
      return querySnap.docs.map((doc) => InstitutionRecord.fromFirestore(doc.data(), doc.id)).toList();
    } catch (e) {
      rethrow;
    }
  }

  static String generateCsprngInvitationCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final rnd = math.Random.secure();
    final buffer = StringBuffer('inv_');
    for (int i = 0; i < 22; i++) {
      buffer.write(chars[rnd.nextInt(chars.length)]);
    }
    return buffer.toString();
  }

  static Future<InstitutionRecord> createInstitution({
    required String name,
    String type = 'center',
    String phone = '',
    String email = '',
    String ownerEmail = '',
    String ownerInvitationCode = '',
    String address = '',
    Map<String, dynamic>? branding,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create institutions.');
    }

    final docRef = _db.collection('institutions').doc();
    final nowISO = DateTime.now().toIso8601String();

    final defaultBranding = {
      'logoUrl': '',
      'primaryColor': '#1E293B',
      'secondaryColor': '#38BDF8',
      'centerName': name,
    };
    if (branding != null) {
      defaultBranding.addAll(branding.map((k, v) => MapEntry(k, v.toString())));
    }

    final instRecord = InstitutionRecord(
      institutionId: docRef.id,
      name: name.trim(),
      type: type,
      status: 'ACTIVE',
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      branding: defaultBranding,
      ownerId: 'PENDING_OWNER',
      ownerEmail: ownerEmail.trim().toLowerCase(),
      ownerInvitationCode: ownerInvitationCode.trim(),
      createdBy: currentUser!.uid,
      createdAt: nowISO,
      updatedAt: nowISO,
    );

    await docRef.set(instRecord.toFirestore());
    return instRecord;
  }

  static Future<OwnerInvitationRecord> createOwnerInvitation({
    required String institutionId,
    required String email,
    required String phone,
    required String invitationCode,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create owner invitations.');
    }

    final code = invitationCode.trim();
    final now = DateTime.now();
    final expires = now.add(const Duration(days: 7));

    final invRecord = OwnerInvitationRecord(
      invitationId: code,
      invitationCode: code,
      institutionId: institutionId,
      email: email.trim().toLowerCase(),
      ownerEmail: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: 'institutionOwner',
      status: 'PENDING',
      createdAt: now.toIso8601String(),
      expiresAt: expires.toIso8601String(),
    );

    // Save directly to top-level invitations collection with doc ID = invitationCode
    await _db.collection('invitations').doc(code).set(invRecord.toFirestore());

    return invRecord;
  }

  static Future<List<LicenseRecord>> getLicenses() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list licenses.');
    }

    final querySnap = await _db.collection('licenses').get();
    return querySnap.docs.map((doc) => LicenseRecord.fromFirestore(doc.data(), doc.id)).toList();
  }

  static Future<LicenseRecord> createLicense({
    required String institutionId,
    String plan = 'PRO',
    int durationDays = 365,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create licenses.');
    }

    final docRef = _db.collection('licenses').doc();
    final now = DateTime.now();
    final expires = now.add(Duration(days: durationDays));

    final codePart = institutionId.length >= 4 
        ? institutionId.substring(0, 4).toUpperCase() 
        : institutionId.toUpperCase();
    final licenseCode = 'REMAS-$codePart-${now.year}-${now.millisecondsSinceEpoch.toString().substring(8)}';

    final licenseRecord = LicenseRecord(
      licenseId: docRef.id,
      institutionId: institutionId,
      licenseCode: licenseCode,
      plan: plan,
      status: 'ACTIVE',
      issuedAt: now.toIso8601String(),
      expiresAt: expires.toIso8601String(),
      deviceBindingId: '',
      deviceBindingStatus: 'UNBOUND',
    );

    await docRef.set(licenseRecord.toFirestore());
    return licenseRecord;
  }

  static Future<void> activateLicense({required String licenseId}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can activate licenses.');
    }
    await _db.collection('licenses').doc(licenseId).update({
      'status': 'ACTIVE',
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  // NO false success: write failures propagate as failures (no catch-and-report-OK).
  static Future<Map<String, dynamic>> suspendLicense({String? licenseId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can suspend licenses.');
    }
    if (reason.trim().length < 3) {
      throw Exception('INVALID_INPUT: سبب الإيقاف مطلوب (3 أحرف على الأقل).');
    }
    final targetId = licenseId ?? institutionId ?? '';
    final snap = await _db.collection('licenses').doc(targetId).get();
    final licInst = snap.exists ? (snap.data()?['institutionId'] ?? '').toString() : (institutionId ?? '');
    await _db.collection('licenses').doc(targetId).update({
      'status': 'SUSPENDED',
      'statusReason': reason.trim(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
    final audit = await AuditService.record(
      action: 'LICENSE_SUSPENDED',
      institutionId: licInst,
      targetType: 'LICENSE',
      targetId: targetId,
      reason: reason.trim(),
    );
    return {'status': 'LICENSE_SUSPENDED_SUCCESSFULLY', 'institutionId': institutionId ?? targetId, if (audit.warning != null) 'auditWarning': audit.warning};
  }

  static Future<Map<String, dynamic>> revokeLicense({String? licenseId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can revoke licenses.');
    }
    if (reason.trim().length < 3) {
      throw Exception('INVALID_INPUT: سبب الإلغاء مطلوب (3 أحرف على الأقل).');
    }
    final targetId = licenseId ?? institutionId ?? '';
    final snap = await _db.collection('licenses').doc(targetId).get();
    final licInst = snap.exists ? (snap.data()?['institutionId'] ?? '').toString() : (institutionId ?? '');
    await _db.collection('licenses').doc(targetId).update({
      'status': 'REVOKED',
      'statusReason': reason.trim(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
    final audit = await AuditService.record(
      action: 'LICENSE_REVOKED',
      institutionId: licInst,
      targetType: 'LICENSE',
      targetId: targetId,
      reason: reason.trim(),
    );
    return {'status': 'LICENSE_REVOKED_SUCCESSFULLY', 'institutionId': institutionId ?? targetId, if (audit.warning != null) 'auditWarning': audit.warning};
  }

  static Future<void> renewLicense({required String licenseId, required int extensionDays}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can renew licenses.');
    }
    final doc = await _db.collection('licenses').doc(licenseId).get();
    if (!doc.exists) {
      throw Exception('LICENSE_NOT_FOUND: license $licenseId does not exist');
    }
    final currentExpiry = DateTime.tryParse(doc.data()?['expiresAt'] ?? '') ?? DateTime.now();
    final newExpiry = currentExpiry.add(Duration(days: extensionDays));

    await _db.collection('licenses').doc(licenseId).update({
      'expiresAt': newExpiry.toIso8601String(),
      'status': 'ACTIVE',
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  static Future<List<DeviceBindingRecord>> getDeviceBindings() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list device bindings.');
    }
    final querySnap = await _db.collection('deviceBindings').get();
    return querySnap.docs.map((doc) => DeviceBindingRecord.fromFirestore(doc.data(), doc.id)).toList();
  }

  // ---------------------------------------------------------------
  // Batch 2A follow-up — SuperAdmin AI governance (per-institution).
  // aiConfig writes are SuperAdmin-only (Rules + service double-enforced);
  // provider/model/secrets stay in existing server-side management and are
  // NEVER read or written here. Center Desktop remains read-only.
  // ---------------------------------------------------------------

  static void _requireSuperAdmin(String operation) {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can $operation.');
    }
  }

  static Future<AiGovernanceConfig> getAiGovernance({
    required String institutionId,
  }) async {
    _requireSuperAdmin('read AI governance');
    final cleanId = institutionId.trim();
    if (cleanId.isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: institutionId is required');
    }
    try {
      final doc = await _db
          .collection('institutions')
          .doc(cleanId)
          .collection('aiConfig')
          .doc('config')
          .get();
      if (!doc.exists) {
        return AiGovernanceConfig.missing(cleanId);
      }
      return AiGovernanceConfig.fromFirestore(
          Map<String, dynamic>.from(doc.data() ?? {}), cleanId);
    } catch (e) {
      if (e.toString().contains('UNAUTHORIZED_CALLER_ROLE')) rethrow;
      throw Exception('AI_CONFIG_READ_FAILED: تعذر قراءة حوكمة الذكاء الاصطناعي (${e.toString().split(':').first})');
    }
  }

  static Future<AiGovernanceConfig> saveAiGovernance({
    required String institutionId,
    required bool aiEnabled,
    required bool questionGenerationEnabled,
    required int monthlyLimit,
    bool tutorEnabled = false,
    int tutorMonthlyLimit = 50,
    bool teacherAssistantEnabled = false,
    int teacherMonthlyLimit = 30,
    int totalMonthlyLimit = 5000,
    bool vipSubscriptionRequired = false,
  }) async {
    _requireSuperAdmin('update AI governance');
    final cleanId = institutionId.trim();
    if (cleanId.isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: institutionId is required');
    }
    AiGovernanceConfig.validateMonthlyLimit(monthlyLimit);
    AiGovernanceConfig.validateMonthlyLimit(tutorMonthlyLimit);
    AiGovernanceConfig.validateMonthlyLimit(teacherMonthlyLimit);
    AiGovernanceConfig.validateMonthlyLimit(totalMonthlyLimit);
    final nowISO = DateTime.now().toIso8601String();
    final config = AiGovernanceConfig(
      institutionId: cleanId,
      aiEnabled: aiEnabled,
      questionGenerationEnabled: questionGenerationEnabled,
      monthlyLimit: monthlyLimit,
      tutorEnabled: tutorEnabled,
      tutorMonthlyLimit: tutorMonthlyLimit,
      teacherAssistantEnabled: teacherAssistantEnabled,
      teacherMonthlyLimit: teacherMonthlyLimit,
      totalMonthlyLimit: totalMonthlyLimit,
      vipSubscriptionRequired: vipSubscriptionRequired,
      updatedAt: nowISO,
      updatedBy: currentUser!.uid,
    );
    try {
      await _db
          .collection('institutions')
          .doc(cleanId)
          .collection('aiConfig')
          .doc('config')
          .set({...config.toFirestore(), 'updatedAt': nowISO, 'updatedBy': currentUser!.uid},
              SetOptions(merge: true));
      return config;
    } catch (e) {
      if (e.toString().contains('UNAUTHORIZED_CALLER_ROLE')) rethrow;
      throw Exception('AI_CONFIG_WRITE_FAILED: تعذر حفظ حوكمة الذكاء الاصطناعي (${e.toString().split(':').first})');
    }
  }

  /// Reads central master AI configuration from `system/aiConfig`.
  static Future<SystemAiMasterConfig> getSystemAiMasterConfig() async {
    _requireSuperAdmin('read system AI config');
    try {
      final doc = await _db.collection('system').doc('aiConfig').get();
      if (!doc.exists || doc.data() == null) {
        return SystemAiMasterConfig();
      }
      return SystemAiMasterConfig.fromFirestore(doc.data()!);
    } catch (e) {
      if (e.toString().contains('UNAUTHORIZED_CALLER_ROLE')) rethrow;
      throw Exception('SYSTEM_AI_CONFIG_READ_FAILED: تعذر قراءة تهيئة الذكاء المركزية (${e.toString()})');
    }
  }

  /// Saves central master AI configuration to `system/aiConfig`.
  static Future<void> saveSystemAiMasterConfig({
    required bool enabled,
    required String primaryModel,
    required List<String> geminiKeys,
  }) async {
    _requireSuperAdmin('update system AI config');
    final nowISO = DateTime.now().toIso8601String();
    final cfg = SystemAiMasterConfig(
      enabled: enabled,
      primaryModel: primaryModel.trim().isEmpty ? 'gemini-2.0-flash' : primaryModel.trim(),
      geminiKeys: geminiKeys.map((k) => k.trim()).where((k) => k.isNotEmpty).toList(),
      updatedAt: nowISO,
      updatedBy: currentUser!.uid,
    );
    try {
      await _db.collection('system').doc('aiConfig').set(cfg.toFirestore(), SetOptions(merge: true));
    } catch (e) {
      if (e.toString().contains('UNAUTHORIZED_CALLER_ROLE')) rethrow;
      throw Exception('SYSTEM_AI_CONFIG_WRITE_FAILED: تعذر حفظ تهيئة الذكاء المركزية (${e.toString()})');
    }
  }

  static Future<List<AiUsageRecord>> getAiUsage({
    required String institutionId,
    int limit = 12,
  }) async {
    _requireSuperAdmin('read AI usage');
    final cleanId = institutionId.trim();
    if (cleanId.isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: institutionId is required');
    }
    try {
      final querySnap = await _db
          .collection('institutions')
          .doc(cleanId)
          .collection('aiUsage')
          .orderBy('month', descending: true)
          .limit(limit)
          .get();
      return querySnap.docs
          .map((doc) => AiUsageRecord.fromFirestore(
              Map<String, dynamic>.from(doc.data()), doc.id))
          .toList();
    } catch (e) {
      if (e.toString().contains('UNAUTHORIZED_CALLER_ROLE')) rethrow;
      throw Exception('AI_USAGE_READ_FAILED: تعذر قراءة سجلات الاستهلاك (${e.toString().split(':').first})');
    }
  }

  /// Approve a PENDING device request (canonical collection). Sets BOUND +
  /// mirrors the license binding. Failures propagate (no false success).
  static Future<Map<String, dynamic>> approveDeviceBinding({required String bindingId}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can approve device bindings.');
    }
    final nowISO = DateTime.now().toIso8601String();
    final doc = await _db.collection('deviceBindings').doc(bindingId).get();
    if (!doc.exists) {
      throw Exception('BINDING_NOT_FOUND: device binding $bindingId does not exist');
    }
    final data = doc.data() ?? {};
    if (data['status'] != 'PENDING') {
      throw Exception('INVALID_BINDING_STATE: only PENDING requests can be approved (current: ${data['status']})');
    }
    await _db.collection('deviceBindings').doc(bindingId).update({
      'status': 'BOUND',
      'boundAt': data['boundAt'] ?? nowISO,
      'lastSeenAt': nowISO,
      'updatedAt': nowISO,
      'approvedBy': currentUser!.uid,
    });
    final licenseId = (data['licenseId'] ?? '').toString();
    if (licenseId.isNotEmpty) {
      await _db.collection('licenses').doc(licenseId).update({
        'deviceBindingId': bindingId,
        'deviceBindingStatus': 'BOUND',
        'deviceFingerprintHash': data['deviceFingerprintHash'],
        'deviceName': data['deviceName'],
        'updatedAt': nowISO,
      });
    }
    return {'status': 'DEVICE_APPROVED_SUCCESSFULLY', 'bindingId': bindingId};
  }

  // NO false success: BINDING_NOT_FOUND and write failures propagate.
  static Future<Map<String, dynamic>> unbindDevice({String? bindingId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can unbind devices.');
    }
    final targetId = bindingId ?? institutionId ?? '';
    final doc = await _db.collection('deviceBindings').doc(targetId).get();
    if (!doc.exists) {
      throw Exception('BINDING_NOT_FOUND: device binding $targetId does not exist');
    }
    final licenseId = doc.data()?['licenseId'];
    await _db.collection('deviceBindings').doc(targetId).update({
      'status': 'UNBOUND',
      'unboundReason': reason,
      'unboundAt': DateTime.now().toIso8601String(),
    });
    if (licenseId != null && licenseId.toString().isNotEmpty) {
      await _db.collection('licenses').doc(licenseId).update({
        'deviceBindingId': '',
        'deviceBindingStatus': 'UNBOUND',
        'deviceFingerprintHash': null,
        'deviceName': null,
        'updatedAt': DateTime.now().toIso8601String(),
      });
    }
    return {'status': 'DEVICE_UNBOUND_SUCCESSFULLY', 'institutionId': institutionId ?? targetId};
  }

  // ---------------------------------------------------------------
  // REAL dashboard people counts (SuperAdmin scope, fail-isolated).
  // Source: institutions/{id}/students + institutions/{id}/teachers
  // via count() aggregation. Rules grant SuperAdmin read on these
  // subcollections; no rule change is needed or performed here.
  // Only institutions returned by getInstitutions() (the authorized
  // scope) are counted — never cross-scope tenants. A denied or
  // unreachable institution is isolated into failedInstitutionIds.
  // ---------------------------------------------------------------

  static Future<int> _countSubcollection({
    required String institutionId,
    required String subcollection,
  }) async {
    final agg = await _db
        .collection('institutions')
        .doc(institutionId)
        .collection(subcollection)
        .count()
        .get()
        .timeout(const Duration(seconds: 15), onTimeout: () {
      throw Exception('COUNT_TIMEOUT: انتهت مهلة قراءة $subcollection للمؤسسة $institutionId');
    });
    final value = agg.count;
    if (value == null) {
      throw Exception('COUNT_UNKNOWN: تعذر تحديد عدد $subcollection للمؤسسة $institutionId');
    }
    return value;
  }

  static String _peopleFailureReason(Object e) {
    final raw = e.toString();
    if (raw.contains('permission-denied') || raw.contains('PERMISSION_DENIED')) {
      return 'PERMISSION_DENIED: الحساب الحالي لا يملك صلاحية قراءة سجلات الطلاب/المعلمين في مشروع الإنتاج.';
    }
    if (raw.contains('COUNT_TIMEOUT') || raw.contains('TIMEOUT') || raw.contains('network') || raw.contains('UNAVAILABLE')) {
      return 'CONNECTION_FAILED: تعذر الوصول إلى قاعدة البيانات — تحقق من الاتصال ثم أعد المحاولة.';
    }
    if (raw.contains('UNAUTHENTICATED') || raw.contains('unauthenticated')) {
      return 'SESSION_EXPIRED: انتهت الجلسة — سجّل الدخول مجددًا.';
    }
    return 'PEOPLE_COUNT_FAILED: تعذر قراءة الأعداد (${raw.split(':').first})';
  }

  /// Real totals across the authorized institution scope.
  static Future<PeopleSummary> getPeopleSummary({List<String>? institutionIds}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can read people counts.');
    }
    List<String> ids = institutionIds ?? [];
    if (ids.isEmpty) {
      final insts = await getInstitutions();
      ids = insts.map((i) => i.institutionId).toList();
    }
    if (ids.isEmpty) {
      return PeopleSummary.emptyScope();
    }
    int students = 0;
    int teachers = 0;
    int counted = 0;
    final failed = <String>[];
    String firstReason = '';
    for (final id in ids) {
      try {
        final s = await _countSubcollection(institutionId: id, subcollection: 'students');
        final t = await _countSubcollection(institutionId: id, subcollection: 'teachers');
        students += s;
        teachers += t;
        counted++;
      } catch (e) {
        failed.add(id);
        firstReason = firstReason.isEmpty ? _peopleFailureReason(e) : firstReason;
      }
    }
    if (counted == 0) {
      return PeopleSummary.unavailable(
        firstReason.isEmpty ? 'PEOPLE_COUNT_FAILED: تعذر قراءة الأعداد من جميع المؤسسات.' : firstReason,
        ids.length,
      );
    }
    return PeopleSummary(
      totalStudents: students,
      totalTeachers: teachers,
      institutionsCounted: counted,
      institutionsTotal: ids.length,
      failedInstitutionIds: failed,
      available: true,
      reason: failed.isNotEmpty ? firstReason : '',
    );
  }

  /// Real per-institution counts for the institutions list (fail-isolated
  /// per institution; missing entries mean "unavailable", never zero).
  static Future<Map<String, Map<String, int>>> getPeopleCountsByInstitution({
    required List<String> institutionIds,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can read people counts.');
    }
    final result = <String, Map<String, int>>{};
    for (final id in institutionIds) {
      try {
        final s = await _countSubcollection(institutionId: id, subcollection: 'students');
        final t = await _countSubcollection(institutionId: id, subcollection: 'teachers');
        result[id] = {'students': s, 'teachers': t};
      } catch (_) {
        // Isolated: leave the entry absent so the UI shows "غير متاح".
      }
    }
    return result;
  }

  // ---------------------------------------------------------------
  // License delete (explicit, verified, no silent success).
  // Rules already allow SuperAdmin delete; no rule change here.
  // A license BOUND to a device is refused: delete the binding first
  // (via unbindDevice) so no orphaned deviceBindings remain.
  // ---------------------------------------------------------------

  static Future<Map<String, dynamic>> deleteLicense({
    required String licenseId,
    required String expectedCode,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can delete licenses.');
    }
    LicenseDeletePolicy.validateDeleteIntent(licenseId: licenseId, expectedCode: expectedCode);
    final ref = _db.collection('licenses').doc(licenseId);
    final snap = await ref.get().timeout(const Duration(seconds: 15));
    if (!snap.exists) {
      throw Exception('LICENSE_NOT_FOUND: الترخيص غير موجود (ربما حُذف مسبقًا) — لم يُحذف شيء.');
    }
    final lic = LicenseRecord.fromFirestore(
        Map<String, dynamic>.from(snap.data() ?? {}), snap.id);
    // Wrong-doc guard: the caller must prove WHICH license it means.
    LicenseDeletePolicy.validateTarget(lic, expectedCode);
    // Orphan guard: a bound license must be unbound first.
    LicenseDeletePolicy.validateUnbound(lic);
    await ref.delete().timeout(const Duration(seconds: 15));
    final verify = await ref.get().timeout(const Duration(seconds: 15));
    if (verify.exists) {
      throw Exception('LICENSE_DELETE_UNVERIFIED: تعذّر التأكد من الحذف — أعد تحميل القائمة قبل إعادة المحاولة.');
    }
    final audit = await AuditService.record(
      action: 'LICENSE_DELETED',
      institutionId: lic.institutionId,
      targetType: 'LICENSE',
      targetId: licenseId,
      reason: 'حذف نهائي مؤكد بالكود (غير مرتبط بجهاز)',
      details: {'licenseCode': lic.licenseCode},
    );
    return {
      'status': 'LICENSE_DELETED_SUCCESSFULLY',
      'licenseId': licenseId,
      'licenseCode': lic.licenseCode,
      'institutionId': lic.institutionId,
      if (audit.warning != null) 'auditWarning': audit.warning,
    };
  }

  // ---------------------------------------------------------------
  // Institution dependents + safe delete / suspend / archive.
  // The institution document delete is allowed for SuperAdmin, but its
  // subcollections are NOT cascade-deleted by Firestore. Deleting a
  // non-empty institution would orphan tenant data — so deletion is
  // permitted ONLY when every dependent scope counts zero. Otherwise the
  // caller gets the exact blockers and must suspend/archive instead.
  // ---------------------------------------------------------------

  static Future<int> _countQuery(
    Query<Map<String, dynamic>> query,
    String label,
  ) async {
    final agg = await query
        .count()
        .get()
        .timeout(const Duration(seconds: 15), onTimeout: () {
      throw Exception('COUNT_TIMEOUT: انتهت مهلة فحص $label');
    });
    return agg.count ?? 0;
  }

  static Future<Map<String, int>> getInstitutionDependents({
    required String institutionId,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can inspect institution dependents.');
    }
    final cleanId = institutionId.trim();
    if (cleanId.isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: institutionId is required');
    }
    final instDoc = _db.collection('institutions').doc(cleanId);
    // Per-scope isolation: -1 marks "unreadable" so the delete policy
    // blocks instead of treating a failed check as zero.
    Future<int> guarded(Future<int> f) => f.then<int>((v) => v, onError: (_) => -1);
    final List<int> results = await Future.wait<int>([
      guarded(_countSubcollection(institutionId: cleanId, subcollection: 'students')),
      guarded(_countSubcollection(institutionId: cleanId, subcollection: 'teachers')),
      guarded(_countSubcollection(institutionId: cleanId, subcollection: 'users')),
      guarded(_countQuery(_db.collection('licenses').where('institutionId', isEqualTo: cleanId), 'التراخيص')),
      guarded(_countQuery(_db.collection('deviceBindings').where('institutionId', isEqualTo: cleanId), 'الأجهزة')),
      guarded(_countQuery(_db.collection('invitations').where('institutionId', isEqualTo: cleanId), 'الدعوات')),
      guarded(_countSubcollection(institutionId: cleanId, subcollection: 'aiUsage')),
      guarded(instDoc.collection('aiConfig').doc('config').get().then((d) => d.exists ? 1 : 0)),
    ]);
    return {
      'students': results[0],
      'teachers': results[1],
      'users': results[2],
      'licenses': results[3],
      'devices': results[4],
      'invitations': results[5],
      'aiUsage': results[6],
      'aiConfig': results[7],
    };
  }

  static Future<Map<String, dynamic>> deleteInstitution({
    required String institutionId,
    required String expectedName,
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can delete institutions.');
    }
    final cleanId = institutionId.trim();
    if (cleanId.isEmpty || expectedName.trim().isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: institutionId and expectedName are required');
    }
    final ref = _db.collection('institutions').doc(cleanId);
    final snap = await ref.get().timeout(const Duration(seconds: 15));
    if (!snap.exists) {
      throw Exception('INSTITUTION_NOT_FOUND: المؤسسة غير موجودة (ربما حُذفت مسبقًا) — لم يُحذف شيء.');
    }
    final record = InstitutionRecord.fromFirestore(
        Map<String, dynamic>.from(snap.data() ?? {}), snap.id);
    // Wrong-institution guard: the caller must name the exact target.
    if (record.name.trim() != expectedName.trim()) {
      throw Exception('INSTITUTION_NAME_MISMATCH: اسم المؤسسة لا يطابق السجل — أُلغي الحذف لمنع حذف مؤسسة أخرى بالخطأ.');
    }
    final dependents = await getInstitutionDependents(institutionId: cleanId);
    final decision = InstitutionDeletePolicy.decide(dependents);
    if (!decision.allowed) {
      throw Exception('INSTITUTION_DELETE_BLOCKED: ${decision.reason}');
    }
    await ref.delete().timeout(const Duration(seconds: 15));
    final verify = await ref.get().timeout(const Duration(seconds: 15));
    if (verify.exists) {
      throw Exception('INSTITUTION_DELETE_UNVERIFIED: تعذّر التأكد من الحذف — أعد تحميل القائمة قبل إعادة المحاولة.');
    }
    final audit = await AuditService.record(
      action: 'INSTITUTION_DELETED',
      institutionId: cleanId,
      targetType: 'INSTITUTION',
      targetId: cleanId,
      reason: 'حذف نهائي بعد فحص خلو الارتباطات وتسمية المؤسسة',
      details: {'institutionName': record.name},
    );
    return {
      'status': 'INSTITUTION_DELETED_SUCCESSFULLY',
      'institutionId': cleanId,
      'institutionName': record.name,
      if (audit.warning != null) 'auditWarning': audit.warning,
    };
  }

  static const List<String> _mutableInstitutionStatuses = [
    'ACTIVE',
    'SUSPENDED',
    'ARCHIVED',
  ];

  /// Disable (SUSPENDED) or archive (ARCHIVED) instead of deleting.
  /// Data is preserved; only the status flag (+reason) changes. The reason is
  /// mandatory for SUSPENDED/ARCHIVED so the audit trail stays meaningful.
  static Future<Map<String, dynamic>> setInstitutionStatus({
    required String institutionId,
    required String status,
    String reason = '',
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can change institution status.');
    }
    if (!_mutableInstitutionStatuses.contains(status)) {
      throw Exception("INVALID_INPUT: status must be one of ACTIVE/SUSPENDED/ARCHIVED");
    }
    if ((status == 'SUSPENDED' || status == 'ARCHIVED') && reason.trim().length < 3) {
      throw Exception('INVALID_INPUT: سبب التعطيل/الأرشفة مطلوب (3 أحرف على الأقل).');
    }
    final ref = _db.collection('institutions').doc(institutionId.trim());
    final snap = await ref.get().timeout(const Duration(seconds: 15));
    if (!snap.exists) {
      throw Exception('INSTITUTION_NOT_FOUND: المؤسسة غير موجودة — لم يتغير شيء.');
    }
    await ref.update({
      'status': status,
      if (reason.trim().isNotEmpty) 'statusReason': reason.trim(),
      'updatedAt': DateTime.now().toIso8601String(),
    }).timeout(const Duration(seconds: 15));
    final audit = await AuditService.record(
      action: status == 'ACTIVE' ? 'INSTITUTION_REACTIVATED' : (status == 'SUSPENDED' ? 'INSTITUTION_SUSPENDED' : 'INSTITUTION_ARCHIVED'),
      institutionId: ref.id,
      targetType: 'INSTITUTION',
      targetId: ref.id,
      reason: reason.trim(),
    );
    return {
      'status': 'INSTITUTION_STATUS_UPDATED',
      'institutionId': ref.id,
      if (audit.warning != null) 'auditWarning': audit.warning,
      'newStatus': status,
    };
  }

  // =========================================================================
  // OTA Hotpatch Fleet Control
  // =========================================================================

  static Future<Map<String, dynamic>?> getLatestHotpatch() async {
    _requireSuperAdmin('read hotpatch status');
    try {
      final doc = await _db.collection('licenses').doc('system_hotpatch_latest').get();
      if (!doc.exists || doc.data() == null) return null;
      return doc.data();
    } catch (_) {
      return null;
    }
  }

  static Future<void> toggleHotpatchActive(bool active) async {
    _requireSuperAdmin('toggle hotpatch status');
    await _db.collection('licenses').doc('system_hotpatch_latest').update({
      'active': active,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  static Future<void> publishHotpatchToFleet({
    required String patchVersion,
    required String description,
    List<Map<String, dynamic>>? files,
  }) async {
    _requireSuperAdmin('publish hotpatch to fleet');
    final defaultFiles = [
      {
        'relativePath': 'src/desktop_app.js',
        'url': 'https://raw.githubusercontent.com/ahpalll/remas/main/center-desktop/src/desktop_app.js'
      },
      {
        'relativePath': 'src/center_desktop_services.js',
        'url': 'https://raw.githubusercontent.com/ahpalll/remas/main/center-desktop/src/center_desktop_services.js'
      },
      {
        'relativePath': 'src/hotpatch_service.js',
        'url': 'https://raw.githubusercontent.com/ahpalll/remas/main/center-desktop/src/hotpatch_service.js'
      }
    ];

    await _db.collection('licenses').doc('system_hotpatch_latest').set({
      'institutionId': 'GLOBAL_FLEET',
      'patchVersion': patchVersion.trim(),
      'description': description.trim(),
      'publishedAt': DateTime.now().toIso8601String(),
      'publishedBy': currentUser?.uid ?? 'superadmin',
      'active': true,
      'files': files ?? defaultFiles,
    }, SetOptions(merge: true));
  }
}
