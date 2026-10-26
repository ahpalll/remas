class StudentProfileDTO {
  final String id;
  final String institutionId;
  final String studentCode;
  final String fullName;
  final String email;
  final String phone;
  final String stageId;
  final String stageName;
  final List<String> groupIds;
  final List<String> enrolledSubjectNames;
  final String status;
  final bool isVip;
  final int aiQuestionsBalance;
  final List<String> unlockedFeatures;
  final String? aiVipExpiresAt;

  StudentProfileDTO({
    required this.id,
    required this.institutionId,
    required this.studentCode,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.stageId,
    required this.stageName,
    required this.groupIds,
    required this.enrolledSubjectNames,
    required this.status,
    this.isVip = false,
    this.aiQuestionsBalance = 0,
    this.unlockedFeatures = const [],
    this.aiVipExpiresAt,
  });

  factory StudentProfileDTO.fromJson(Map<String, dynamic> json) {
    return StudentProfileDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      studentCode: json['studentCode'] ?? '',
      fullName: json['fullName'] ?? json['name'] ?? 'طالب',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      stageId: json['stageId'] ?? '',
      stageName: json['stageName'] ?? 'المرحلة الثانوية',
      groupIds: List<String>.from(json['groupIds'] ?? []),
      enrolledSubjectNames: List<String>.from(json['enrolledSubjectNames'] ?? []),
      status: json['status'] ?? 'ACTIVE',
      isVip: json['isVip'] == true,
      aiQuestionsBalance: int.tryParse((json['aiQuestionsBalance'] ?? 0).toString()) ?? 0,
      unlockedFeatures: List<String>.from(json['unlockedFeatures'] ?? []),
      aiVipExpiresAt: json['aiVipExpiresAt']?.toString(),
    );
  }
}
