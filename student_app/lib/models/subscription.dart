class StudentEntitlementDTO {
  final String id;
  final String institutionId;
  final String studentId;
  final String packageId;
  final String scopeType;
  final List<String> subjectIds;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String status;

  StudentEntitlementDTO({
    required this.id,
    required this.institutionId,
    required this.studentId,
    required this.packageId,
    required this.scopeType,
    required this.subjectIds,
    required this.startsAt,
    required this.expiresAt,
    required this.status,
  });

  factory StudentEntitlementDTO.fromJson(Map<String, dynamic> json) {
    return StudentEntitlementDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      studentId: json['studentId'] ?? '',
      packageId: json['packageId'] ?? '',
      scopeType: json['scopeType'] ?? 'SUBJECT',
      subjectIds: List<String>.from(json['subjectIds'] ?? []),
      startsAt: DateTime.parse(json['startsAt'] ?? DateTime.now().toIso8601String()),
      expiresAt: DateTime.parse(json['expiresAt'] ?? DateTime.now().toIso8601String()),
      status: json['status'] ?? 'ACTIVE',
    );
  }
}
