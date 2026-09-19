
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

