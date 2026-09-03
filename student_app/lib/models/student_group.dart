class StudentGroupDTO {
  final String id;
  final String institutionId;
  final String name;
  final String code;
  final String subjectName;
  final String teacherName;
  final String roomName;

  StudentGroupDTO({
    required this.id,
    required this.institutionId,
    required this.name,
    required this.code,
    required this.subjectName,
    required this.teacherName,
    required this.roomName,
  });

  factory StudentGroupDTO.fromJson(Map<String, dynamic> json) {
    return StudentGroupDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      subjectName: json['subjectName'] ?? 'غير محدد',
      teacherName: json['teacherName'] ?? 'أستاذ المادة',
      roomName: json['roomName'] ?? 'القاعة الرئيسية',
    );
  }
}
