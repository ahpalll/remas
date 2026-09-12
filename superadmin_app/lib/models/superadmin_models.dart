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
  final String status; // ACTIVE, SUSPENDED, ARCHIVED
  final String ownerId;
  final String ownerEmail;
  final String createdAt;
  final int studentCount;
  final int teacherCount;

  InstitutionRecord({
    required this.institutionId,
    required this.name,
    required this.status,
    required this.ownerId,
    required this.ownerEmail,
    required this.createdAt,
    required this.studentCount,
    required this.teacherCount,
  });

  factory InstitutionRecord.fromJson(Map<String, dynamic> json) {
    return InstitutionRecord(
      institutionId: json['institutionId'] ?? '',
      name: json['name'] ?? 'مؤسسة غير معرفة',
      status: json['status'] ?? 'ACTIVE',
      ownerId: json['ownerId'] ?? '',
      ownerEmail: json['ownerEmail'] ?? '',
      createdAt: json['createdAt'] ?? DateTime.now().toIso8601String(),
      studentCount: json['studentCount'] ?? 0,
      teacherCount: json['teacherCount'] ?? 0,
    );
  }
}

class LicenseRecord {
  final String licenseId;
  final String institutionId;
  final String licenseCode;
  final String status; // PENDING_ACTIVATION, ACTIVE, SUSPENDED, EXPIRED, REVOKED
  final String issuedAt;
  final String expiresAt;
  final String deviceBindingStatus; // UNBOUND, BOUND, REVOKED, SUSPENDED
  final String? deviceFingerprintHash;
  final String? deviceName;

  LicenseRecord({
    required this.licenseId,
    required this.institutionId,
    required this.licenseCode,
    required this.status,
    required this.issuedAt,
    required this.expiresAt,
    required this.deviceBindingStatus,
    this.deviceFingerprintHash,
    this.deviceName,
  });

  factory LicenseRecord.fromJson(Map<String, dynamic> json) {
    return LicenseRecord(
      licenseId: json['licenseId'] ?? '',
      institutionId: json['institutionId'] ?? '',
      licenseCode: json['licenseCode'] ?? '',
      status: json['status'] ?? 'PENDING_ACTIVATION',
      issuedAt: json['issuedAt'] ?? '',
      expiresAt: json['expiresAt'] ?? '',
      deviceBindingStatus: json['deviceBindingStatus'] ?? 'UNBOUND',
      deviceFingerprintHash: json['deviceFingerprintHash'],
      deviceName: json['deviceName'],
    );
  }
}

class DeviceBindingRecord {
  final String bindingId;
  final String institutionId;
  final String deviceFingerprintHash;
  final String deviceName;
  final String osVersion;
  final String status;
  final String boundAt;

  DeviceBindingRecord({
    required this.bindingId,
    required this.institutionId,
    required this.deviceFingerprintHash,
    required this.deviceName,
    required this.osVersion,
    required this.status,
    required this.boundAt,
  });
}
