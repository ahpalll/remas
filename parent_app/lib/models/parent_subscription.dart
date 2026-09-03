class ParentEntitlementDTO {
  final String packageId;
  final String scopeType;
  final String subjectName;
  final String status;
  final DateTime expiresAt;

  ParentEntitlementDTO({
    required this.packageId,
    required this.scopeType,
    required this.subjectName,
    required this.status,
    required this.expiresAt,
  });

  factory ParentEntitlementDTO.fromJson(Map<String, dynamic> json) {
    return ParentEntitlementDTO(
      packageId: json['packageId'] ?? '',
      scopeType: json['scopeType'] ?? 'SUBJECT',
      subjectName: json['subjectName'] ?? '',
      status: json['status'] ?? 'ACTIVE',
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : DateTime.now(),
    );
  }
}
