class ParentChildDTO {
  final String id;
  final String studentCode;
  final String fullName;
  final String stageName;
  final String? groupName;
  final double? recentGradePercentage;
  final double? attendancePercentage;

  ParentChildDTO({
    required this.id,
    required this.studentCode,
    required this.fullName,
    required this.stageName,
    this.groupName,
    this.recentGradePercentage,
    this.attendancePercentage,
  });

  factory ParentChildDTO.fromJson(Map<String, dynamic> json) {
    return ParentChildDTO(
      id: json['id'] ?? '',
      studentCode: json['studentCode'] ?? '',
      fullName: json['fullName'] ?? '',
      stageName: json['stageName'] ?? '',
      groupName: json['groupName'],
      recentGradePercentage: (json['recentGradePercentage'] as num?)?.toDouble(),
      attendancePercentage: (json['attendancePercentage'] as num?)?.toDouble(),
    );
  }
}
