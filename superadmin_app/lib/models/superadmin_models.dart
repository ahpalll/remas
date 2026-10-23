
class SuperAdminUser {
  final String uid;
  final String email;
  final String role;
  final String? displayName;

  SuperAdminUser({
    required this.uid,
    required this.email,
    required this.role,
    this.displayName,
  });

  bool get isSuperAdmin => role == 'superadmin' || role == 'superAdmin';
}

class InstitutionRecord {
  final String institutionId;
  final String name;
  final String type;
  final String status; // ACTIVE, SUSPENDED, ARCHIVED
  final String phone;
  final String email;
  final String address;
  final Map<String, dynamic> branding;
  final String ownerId;
  final String ownerEmail;
  final String createdBy;
  final String createdAt;
  final String updatedAt;
  final int studentCount;
  final int teacherCount;

  final String ownerInvitationCode;

  InstitutionRecord({
    required this.institutionId,
    required this.name,
    this.type = 'center',
    required this.status,
    this.phone = '',
    this.email = '',
    this.address = '',
    this.branding = const {},
    required this.ownerId,
    required this.ownerEmail,
    this.ownerInvitationCode = '',
    this.createdBy = '',
    required this.createdAt,
    this.updatedAt = '',
    this.studentCount = 0,
    this.teacherCount = 0,
  });

  factory InstitutionRecord.fromJson(Map<String, dynamic> json) {
    return InstitutionRecord.fromFirestore(json, json['institutionId'] ?? '');
  }

  factory InstitutionRecord.fromFirestore(Map<String, dynamic> json, String id) {
    return InstitutionRecord(
      institutionId: json['institutionId'] ?? id,
      name: json['name'] ?? 'مؤسسة تعليمية',
      type: json['type'] ?? 'center',
      status: json['status'] ?? 'ACTIVE',
      phone: json['phone'] ?? '',
      email: json['email'] ?? '',
      address: json['address'] ?? '',
      branding: Map<String, dynamic>.from(json['branding'] ?? {}),
      ownerId: json['ownerId'] ?? '',
      ownerEmail: json['ownerEmail'] ?? '',
      ownerInvitationCode: json['ownerInvitationCode'] ?? '',
      createdBy: json['createdBy'] ?? '',
      createdAt: json['createdAt'] ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] ?? '',
      studentCount: json['studentCount'] ?? 0,
      teacherCount: json['teacherCount'] ?? 0,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'institutionId': institutionId,
      'name': name,
      'type': type,
      'status': status,
      'phone': phone,
      'email': email,
      'address': address,
      'branding': branding,
      'ownerId': ownerId,
      'ownerEmail': ownerEmail,
      'ownerInvitationCode': ownerInvitationCode,
      'createdBy': createdBy,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'studentCount': studentCount,
      'teacherCount': teacherCount,
    };
  }
}

class LicenseRecord {
  final String licenseId;
  final String institutionId;
  final String licenseCode;
  final String plan; // STANDARD, PRO, ENTERPRISE
  final String status; // ACTIVE, SUSPENDED, EXPIRED, REVOKED, PENDING_ACTIVATION
  final String issuedAt;
  final String expiresAt;
  final String deviceBindingId;
  final String deviceBindingStatus; // UNBOUND, BOUND, REVOKED, SUSPENDED
  final String? deviceFingerprintHash;
  final String? deviceName;
  final String statusReason; // SuperAdmin reason for SUSPENDED/REVOKED (may be empty)

  LicenseRecord({
    required this.licenseId,
    required this.institutionId,
    required this.licenseCode,
    this.plan = 'PRO',
    required this.status,
    required this.issuedAt,
    required this.expiresAt,
    this.deviceBindingId = '',
    required this.deviceBindingStatus,
    this.deviceFingerprintHash,
    this.deviceName,
    this.statusReason = '',
  });

  factory LicenseRecord.fromJson(Map<String, dynamic> json) {
    return LicenseRecord.fromFirestore(json, json['licenseId'] ?? '');
  }

  factory LicenseRecord.fromFirestore(Map<String, dynamic> json, String id) {
    return LicenseRecord(
      licenseId: json['licenseId'] ?? id,
      institutionId: json['institutionId'] ?? '',
      licenseCode: json['licenseCode'] ?? (json['licenseId'] ?? id).toUpperCase(),
      plan: json['plan'] ?? 'PRO',
      status: json['status'] ?? 'PENDING_ACTIVATION',
      issuedAt: json['startAt'] ?? json['issuedAt'] ?? '',
      expiresAt: json['expiresAt'] ?? '',
      deviceBindingId: json['deviceBindingId'] ?? '',
      deviceBindingStatus: json['deviceBindingStatus'] ?? (json['deviceBindingId'] != null && json['deviceBindingId'].toString().isNotEmpty ? 'BOUND' : 'UNBOUND'),
      deviceFingerprintHash: json['deviceFingerprintHash'],
      deviceName: json['deviceName'],
      statusReason: (json['statusReason'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'licenseId': licenseId,
      'institutionId': institutionId,
      'licenseCode': licenseCode,
      'plan': plan,
      'status': status,
      'startAt': issuedAt,
      'issuedAt': issuedAt,
      'expiresAt': expiresAt,
      'deviceBindingId': deviceBindingId,
      'deviceBindingStatus': deviceBindingStatus,
      'deviceFingerprintHash': deviceFingerprintHash,
      'deviceName': deviceName,
    };
  }
}

class DeviceBindingRecord {
  final String bindingId;
  final String institutionId;
  final String licenseId;
  final String deviceFingerprintHash;
  final String deviceName;
  final String osVersion;
  final String status; // BOUND, UNBOUND, SUSPENDED, REVOKED
  final String boundAt;
  final String updatedAt;

  DeviceBindingRecord({
    required this.bindingId,
    required this.institutionId,
    this.licenseId = '',
    required this.deviceFingerprintHash,
    required this.deviceName,
    required this.osVersion,
    required this.status,
    required this.boundAt,
    this.updatedAt = '',
  });

  factory DeviceBindingRecord.fromFirestore(Map<String, dynamic> json, String id) {
    return DeviceBindingRecord(
      bindingId: json['bindingId'] ?? id,
      institutionId: json['institutionId'] ?? '',
      licenseId: json['licenseId'] ?? '',
      deviceFingerprintHash: json['deviceFingerprintHash'] ?? json['fingerprintHash'] ?? '',
      deviceName: json['deviceName'] ?? 'Windows PC',
      osVersion: json['osVersion'] ?? 'Windows 10/11',
      status: json['status'] ?? 'BOUND',
      boundAt: json['boundAt'] ?? json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }
}

/// Batch 2A follow-up — per-institution AI governance (SuperAdmin-owned).
/// Mirrors `institutions/{id}/aiConfig/config`. Provider secrets are NEVER
/// stored here (server-side secret management only).
class AiGovernanceConfig {
  final String institutionId;
  final bool aiEnabled;
  final bool questionGenerationEnabled;
  final int monthlyLimit;
  final bool tutorEnabled;
  final int tutorMonthlyLimit;
  final bool teacherAssistantEnabled;
  final int teacherMonthlyLimit;
  final int totalMonthlyLimit;
  final bool vipSubscriptionRequired;
  final int currentMonthUsage;
  final String updatedAt;
  final String updatedBy;

  AiGovernanceConfig({
    required this.institutionId,
    this.aiEnabled = false,
    this.questionGenerationEnabled = false,
    this.monthlyLimit = 20,
    this.tutorEnabled = false,
    this.tutorMonthlyLimit = 50,
    this.teacherAssistantEnabled = false,
    this.teacherMonthlyLimit = 30,
    this.totalMonthlyLimit = 5000,
    this.vipSubscriptionRequired = false,
    this.currentMonthUsage = 0,
    this.updatedAt = '',
    this.updatedBy = '',
  });

  factory AiGovernanceConfig.missing(String institutionId) {
    return AiGovernanceConfig(institutionId: institutionId);
  }

  static int _asLimit(dynamic v, int fallback) {
    if (v is int) return v;
    return int.tryParse(v?.toString() ?? '') ?? fallback;
  }

  factory AiGovernanceConfig.fromFirestore(Map<String, dynamic> json, String institutionId) {
    final features = (json['features'] as Map<String, dynamic>?) ?? const {};
    final qg = (features['questionGeneration'] as Map<String, dynamic>?) ?? const {};
    final tutor = (features['tutor'] as Map<String, dynamic>?) ?? const {};
    final teacher = (features['teacherAssistant'] as Map<String, dynamic>?) ?? const {};
    return AiGovernanceConfig(
      institutionId: json['institutionId']?.toString() ?? institutionId,
      aiEnabled: json['aiEnabled'] == true,
      questionGenerationEnabled: qg['enabled'] == true,
      monthlyLimit: _asLimit(qg['monthlyLimit'], 20),
      tutorEnabled: tutor['enabled'] == true,
      tutorMonthlyLimit: _asLimit(tutor['monthlyLimit'], 50),
      teacherAssistantEnabled: teacher['enabled'] == true,
      teacherMonthlyLimit: _asLimit(teacher['monthlyLimit'], 30),
      totalMonthlyLimit: _asLimit(json['totalMonthlyLimit'] ?? json['monthlyLimit'], 5000),
      vipSubscriptionRequired: json['vipSubscriptionRequired'] == true,
      currentMonthUsage: _asLimit(json['currentMonthUsage'] ?? json['currentUsage'], 0),
      updatedAt: json['updatedAt']?.toString() ?? '',
      updatedBy: json['updatedBy']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': 'config',
      'institutionId': institutionId,
      'aiEnabled': aiEnabled,
      'totalMonthlyLimit': totalMonthlyLimit,
      'vipSubscriptionRequired': vipSubscriptionRequired,
      'currentMonthUsage': currentMonthUsage,
      'features': {
        'questionGeneration': {
          'enabled': questionGenerationEnabled,
          'monthlyLimit': monthlyLimit,
        },
        'tutor': {
          'enabled': tutorEnabled,
          'monthlyLimit': tutorMonthlyLimit,
        },
        'teacherAssistant': {
          'enabled': teacherAssistantEnabled,
          'monthlyLimit': teacherMonthlyLimit,
        },
      },
    };
  }

  /// Shared validation (service also enforces before any write).
  static void validateMonthlyLimit(int limit) {
    if (limit < 0 || limit > 100000) {
      throw Exception('INVALID_AI_LIMIT: الحد الشهري يجب أن يكون رقمًا بين 0 و 100000');
    }
  }
}

/// Central System AI Master Pool configuration stored at `system/aiConfig`.
class SystemAiMasterConfig {
  final bool enabled;
  final String primaryModel;
  final List<String> geminiKeys;
  final String updatedAt;
  final String updatedBy;

  SystemAiMasterConfig({
    this.enabled = true,
    this.primaryModel = 'gemini-2.0-flash',
    this.geminiKeys = const [],
    this.updatedAt = '',
    this.updatedBy = '',
  });

  factory SystemAiMasterConfig.fromFirestore(Map<String, dynamic> data) {
    final rawKeys = data['geminiKeys'];
    final List<String> keys = [];
    if (rawKeys is List) {
      for (final k in rawKeys) {
        if (k != null && k.toString().trim().isNotEmpty) {
          keys.add(k.toString().trim());
        }
      }
    } else if (data['geminiKey'] != null && data['geminiKey'].toString().trim().isNotEmpty) {
      keys.add(data['geminiKey'].toString().trim());
    }
    return SystemAiMasterConfig(
      enabled: data['enabled'] != false,
      primaryModel: (data['primaryModel'] ?? data['model'] ?? 'gemini-2.0-flash').toString(),
      geminiKeys: keys,
      updatedAt: (data['updatedAt'] ?? '').toString(),
      updatedBy: (data['updatedBy'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'enabled': enabled,
      'primaryModel': primaryModel,
      'model': primaryModel,
      'geminiKeys': geminiKeys,
      'geminiKey': geminiKeys.isNotEmpty ? geminiKeys.first : '',
      'updatedAt': updatedAt,
      'updatedBy': updatedBy,
    };
  }
}

/// Monthly AI usage counter. Mirrors `institutions/{id}/aiUsage/*`.
/// Increments are exactly +1 (Rules + Worker CAS); clients never fabricate.
class AiUsageRecord {
  final String id;
  final String institutionId;
  final String feature;
  final String month;
  final int used;
  final int limit;

  AiUsageRecord({
    required this.id,
    required this.institutionId,
    required this.feature,
    required this.month,
    required this.used,
    required this.limit,
  });

  int get remaining => (limit - used) < 0 ? 0 : limit - used;
  double get usageRatio => limit <= 0 ? 1.0 : (used / limit).clamp(0.0, 1.0);
  bool get isExhausted => used >= limit;

  factory AiUsageRecord.fromFirestore(Map<String, dynamic> json, String id) {
    int asInt(dynamic v) {
      if (v is int) return v;
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }
    return AiUsageRecord(
      id: json['id']?.toString() ?? id,
      institutionId: json['institutionId']?.toString() ?? '',
      feature: json['feature']?.toString() ?? '',
      month: json['month']?.toString() ?? id,
      used: asInt(json['used']),
      limit: asInt(json['limit']),
    );
  }
}

/// REAL people-count summary for the SuperAdmin dashboard.
///
/// Counts come ONLY from the authoritative tenant subcollections
/// `institutions/{id}/students` and `institutions/{id}/teachers`, read
/// inside the already-authorized SuperAdmin scope (the institutions list
/// itself). Per-institution read failures are isolated: a denied or
/// unreachable institution is recorded in [failedInstitutionIds] instead
/// of poisoning the whole total. When nothing could be read at all,
/// [available] is false and [reason] explains why — the UI must show
/// that state instead of a misleading zero.
class PeopleSummary {
  final int totalStudents;
  final int totalTeachers;
  final int institutionsCounted;
  final int institutionsTotal;
  final List<String> failedInstitutionIds;
  final bool available;
  final String reason;

  const PeopleSummary({
    required this.totalStudents,
    required this.totalTeachers,
    required this.institutionsCounted,
    required this.institutionsTotal,
    this.failedInstitutionIds = const [],
    required this.available,
    this.reason = '',
  });

  /// Empty scope: zero institutions means zero people (honest, not missing).
  factory PeopleSummary.emptyScope() {
    return const PeopleSummary(
      totalStudents: 0,
      totalTeachers: 0,
      institutionsCounted: 0,
      institutionsTotal: 0,
      available: true,
    );
  }

  /// Total failure: nothing could be read — must render as unavailable.
  factory PeopleSummary.unavailable(String reason, int institutionsTotal) {
    return PeopleSummary(
      totalStudents: 0,
      totalTeachers: 0,
      institutionsCounted: 0,
      institutionsTotal: institutionsTotal,
      available: false,
      reason: reason,
    );
  }

  bool get isPartial =>
      available && failedInstitutionIds.isNotEmpty;
}

/// License expiry classification (pure, testable).
///
/// A license counts as EXPIRED when its status is EXPIRED *or* its
/// `expiresAt` timestamp is in the past. Anything that is neither ACTIVE
/// nor EXPIRED (SUSPENDED/REVOKED/PENDING_*) counts as OTHER. This never
/// invents data — it only labels what Firestore already returned.
class LicenseStatusView {
  static const String active = 'ACTIVE';
  static const String expired = 'EXPIRED';
  static const String other = 'OTHER';

  static String classify(LicenseRecord license, DateTime now) {
    if (license.status == 'ACTIVE') {
      final expiry = DateTime.tryParse(license.expiresAt);
      if (expiry != null && expiry.isBefore(now)) {
        return expired;
      }
      return active;
    }
    if (license.status == 'EXPIRED') return expired;
    final expiry = DateTime.tryParse(license.expiresAt);
    if (expiry != null &&
        expiry.isBefore(now) &&
        (license.status == 'PENDING_ACTIVATION' || license.status.isEmpty)) {
      return expired;
    }
    return other;
  }
}

/// License delete guards (pure, unit-tested).
///
/// - The caller must present the exact license code it intends to delete
///   (wrong-doc protection: id + code must match the live record).
/// - A license bound to a device must be unbound FIRST via the device flow,
///   otherwise its deviceBindings row would dangle.
/// - Failures throw with explicit reasons; success is only reported after
///   the service verifies the document is actually gone.
class LicenseDeletePolicy {
  static void validateDeleteIntent({
    required String licenseId,
    required String expectedCode,
  }) {
    if (licenseId.trim().isEmpty || expectedCode.trim().isEmpty) {
      throw Exception('MISSING_REQUIRED_FIELDS: licenseId and expectedCode are required');
    }
  }

  static void validateTarget(LicenseRecord live, String expectedCode) {
    if (live.licenseCode.trim() != expectedCode.trim()) {
      throw Exception('LICENSE_CODE_MISMATCH: كود الترخيص لا يطابق السجل الحي — أُلغي الحذف لمنع حذف ترخيص آخر بالخطأ.');
    }
  }

  static void validateUnbound(LicenseRecord live) {
    final boundId = live.deviceBindingId.trim();
    if (boundId.isNotEmpty || live.deviceBindingStatus == 'BOUND') {
      throw Exception('LICENSE_BOUND_TO_DEVICE: الترخيص مرتبط بجهاز ($boundId) — فكّ الارتباط من شاشة الأجهزة أولًا، ثم احذف الترخيص.');
    }
  }
}

/// Institution delete decision (pure, unit-tested).
///
/// Firestore never cascade-deletes subcollections, and client rules grant
/// SuperAdmin only the single-document delete. Deleting a non-empty
/// institution would orphan tenant rows — so deletion is allowed solely at
/// zero dependents (-1 means "unreadable", which also blocks).
class InstitutionDeleteDecision {
  final bool allowed;
  final String reason;
  final String suggestedAction; // DELETE | SUSPEND | ARCHIVE | RETRY

  const InstitutionDeleteDecision({
    required this.allowed,
    required this.reason,
    required this.suggestedAction,
  });
}

class InstitutionDeletePolicy {
  static const List<String> dependentKeys = [
    'students',
    'teachers',
    'users',
    'licenses',
    'devices',
    'invitations',
    'aiUsage',
    'aiConfig',
  ];

  static const Map<String, String> arabicNames = {
    'students': 'طلاب',
    'teachers': 'معلمون',
    'users': 'مستخدمون تابعون',
    'licenses': 'تراخيص',
    'devices': 'أجهزة مرتبطة',
    'invitations': 'دعوات مالك',
    'aiUsage': 'سجلات استهلاك AI',
    'aiConfig': 'إعدادات حوكمة AI',
  };

  static InstitutionDeleteDecision decide(Map<String, int> dependents) {
    final unreadable = <String>[];
    final blockers = <String>[];
    for (final k in dependentKeys) {
      final v = dependents[k] ?? -1;
      if (v < 0) {
        unreadable.add(arabicNames[k] ?? k);
      } else if (v > 0) {
        blockers.add('${arabicNames[k] ?? k} ($v)');
      }
    }
    if (unreadable.isNotEmpty) {
      return InstitutionDeleteDecision(
        allowed: false,
        reason: 'تعذّر فحص الارتباطات التالية: ${unreadable.join('، ')} — لا يمكن الحذف الآمن قبل التأكد. أعد المحاولة.',
        suggestedAction: 'RETRY',
      );
    }
    if (blockers.isEmpty) {
      return const InstitutionDeleteDecision(
        allowed: true,
        reason: 'لا توجد بيانات تابعة — الحذف النهائي آمن.',
        suggestedAction: 'DELETE',
      );
    }
    final hasPeopleOrData = (dependents['students'] ?? 0) > 0 ||
        (dependents['teachers'] ?? 0) > 0 ||
        (dependents['users'] ?? 0) > 0 ||
        (dependents['aiUsage'] ?? 0) > 0;
    return InstitutionDeleteDecision(
      allowed: false,
      reason: 'الحذف النهائي محظور لوجود ارتباطات: ${blockers.join('، ')}. احفظ البيانات باستخدام التعطيل أو الأرشفة بدلًا من الحذف.',
      suggestedAction: hasPeopleOrData ? 'ARCHIVE' : 'SUSPEND',
    );
  }
}

class OwnerInvitationRecord {
  final String invitationId;
  final String invitationCode;
  final String institutionId;
  final String email;
  final String ownerEmail;
  final String phone;
  final String role; // institutionOwner
  final String status; // PENDING, ACCEPTED, EXPIRED, REVOKED
  final String createdAt;
  final String expiresAt;

  OwnerInvitationRecord({
    required this.invitationId,
    this.invitationCode = '',
    required this.institutionId,
    required this.email,
    this.ownerEmail = '',
    required this.phone,
    this.role = 'institutionOwner',
    required this.status,
    required this.createdAt,
    required this.expiresAt,
  });

  factory OwnerInvitationRecord.fromFirestore(Map<String, dynamic> json, String id) {
    return OwnerInvitationRecord(
      invitationId: json['invitationId'] ?? json['invitationCode'] ?? id,
      invitationCode: json['invitationCode'] ?? json['invitationId'] ?? id,
      institutionId: json['institutionId'] ?? '',
      email: json['ownerEmail'] ?? json['email'] ?? '',
      ownerEmail: json['ownerEmail'] ?? json['email'] ?? '',
      phone: json['phone'] ?? '',
      role: json['role'] ?? 'institutionOwner',
      status: json['status'] ?? 'PENDING',
      createdAt: json['createdAt'] ?? '',
      expiresAt: json['expiresAt'] ?? '',
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'invitationId': invitationCode.isNotEmpty ? invitationCode : invitationId,
      'invitationCode': invitationCode.isNotEmpty ? invitationCode : invitationId,
      'institutionId': institutionId,
      'email': ownerEmail.isNotEmpty ? ownerEmail : email,
      'ownerEmail': ownerEmail.isNotEmpty ? ownerEmail : email,
      'phone': phone,
      'role': role,
      'status': status,
      'createdAt': createdAt,
      'expiresAt': expiresAt,
    };
  }
}

