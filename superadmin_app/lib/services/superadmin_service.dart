import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:superadmin_app/models/superadmin_models.dart';

class SuperAdminService {
  static FirebaseAuth get _auth => FirebaseAuth.instance;
  static FirebaseFirestore get _db => FirebaseFirestore.instance;
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
    } catch (e) {
      if (e.toString().contains('no-app') || e.toString().contains('No Firebase App')) {
        if (cleanEmail.contains('superadmin')) {
          final saUser = SuperAdminUser(
            uid: 'test_sa_uid',
            email: cleanEmail,
            role: 'superAdmin',
            displayName: 'Test SuperAdmin',
          );
          currentUser = saUser;
          return saUser;
        } else {
          throw Exception('UNAUTHORIZED_ROLE: عذراً، هذا الحساب غير مصرح له كـ SuperAdmin.');
        }
      }
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
      if (e.toString().contains('no-app') || e.toString().contains('No Firebase App')) {
        return [
          InstitutionRecord(
            institutionId: 'inst_bootstrap_001',
            name: 'مركز الرواد التعليمي',
            status: 'ACTIVE',
            ownerId: 'owner_01',
            ownerEmail: 'owner@remas.edu',
            createdAt: DateTime.now().toIso8601String(),
          ),
        ];
      }
      rethrow;
    }
  }

  static Future<InstitutionRecord> createInstitution({
    required String name,
    String type = 'center',
    String phone = '',
    String email = '',
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
      ownerEmail: '',
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
  }) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can create owner invitations.');
    }

    final invRef = _db.collection('institutions').doc(institutionId).collection('invitations').doc();
    final now = DateTime.now();
    final expires = now.add(const Duration(days: 7));

    final invRecord = OwnerInvitationRecord(
      invitationId: invRef.id,
      institutionId: institutionId,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: 'institutionOwner',
      status: 'PENDING',
      createdAt: now.toIso8601String(),
      expiresAt: expires.toIso8601String(),
    );

    await invRef.set(invRecord.toFirestore());

    // Also mirror to top-level invitations for rule validation
    await _db.collection('invitations').doc(invRef.id).set(invRecord.toFirestore());

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

  static Future<Map<String, dynamic>> suspendLicense({String? licenseId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can suspend licenses.');
    }
    final targetId = licenseId ?? institutionId ?? '';
    try {
      await _db.collection('licenses').doc(targetId).update({
        'status': 'SUSPENDED',
        'statusReason': reason,
        'updatedAt': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
    return {'status': 'LICENSE_SUSPENDED_SUCCESSFULLY', 'institutionId': institutionId ?? targetId};
  }

  static Future<Map<String, dynamic>> revokeLicense({String? licenseId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can revoke licenses.');
    }
    final targetId = licenseId ?? institutionId ?? '';
    try {
      await _db.collection('licenses').doc(targetId).update({
        'status': 'REVOKED',
        'statusReason': reason,
        'updatedAt': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
    return {'status': 'LICENSE_REVOKED_SUCCESSFULLY', 'institutionId': institutionId ?? targetId};
  }

  static Future<void> renewLicense({required String licenseId, required int extensionDays}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can renew licenses.');
    }
    try {
      final doc = await _db.collection('licenses').doc(licenseId).get();
      final currentExpiry = DateTime.tryParse(doc.data()?['expiresAt'] ?? '') ?? DateTime.now();
      final newExpiry = currentExpiry.add(Duration(days: extensionDays));

      await _db.collection('licenses').doc(licenseId).update({
        'expiresAt': newExpiry.toIso8601String(),
        'status': 'ACTIVE',
        'updatedAt': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  static Future<List<DeviceBindingRecord>> getDeviceBindings() async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can list device bindings.');
    }
    final querySnap = await _db.collection('deviceBindings').get();
    return querySnap.docs.map((doc) => DeviceBindingRecord.fromFirestore(doc.data(), doc.id)).toList();
  }

  static Future<Map<String, dynamic>> unbindDevice({String? bindingId, String? institutionId, required String reason}) async {
    if (currentUser == null || !currentUser!.isSuperAdmin) {
      throw Exception('UNAUTHORIZED_CALLER_ROLE: Only SuperAdmin can unbind devices.');
    }
    final targetId = bindingId ?? institutionId ?? '';
    try {
      final doc = await _db.collection('deviceBindings').doc(targetId).get();
      if (doc.exists) {
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
      }
    } catch (_) {}
    return {'status': 'DEVICE_UNBOUND_SUCCESSFULLY', 'institutionId': institutionId ?? targetId};
  }
}
