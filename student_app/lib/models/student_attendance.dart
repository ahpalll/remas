enum AttendanceRecordStatus { present, absent, late, excused }

class StudentAttendanceRecordDTO {
  final String id;
  final String institutionId;
  final String sessionId;
  final DateTime sessionDate;
  final String subjectName;
  final AttendanceRecordStatus status;

  StudentAttendanceRecordDTO({
    required this.id,
    required this.institutionId,
    required this.sessionId,
    required this.sessionDate,
    required this.subjectName,
    required this.status,
  });

  factory StudentAttendanceRecordDTO.fromJson(Map<String, dynamic> json) {
    AttendanceRecordStatus parsedStatus = AttendanceRecordStatus.absent;
    final st = (json['status'] ?? '').toString().toUpperCase();
    if (st == 'PRESENT') parsedStatus = AttendanceRecordStatus.present;
    if (st == 'LATE') parsedStatus = AttendanceRecordStatus.late;
    if (st == 'EXCUSED') parsedStatus = AttendanceRecordStatus.excused;

    return StudentAttendanceRecordDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      sessionId: json['sessionId'] ?? '',
      sessionDate: DateTime.parse(json['sessionDate'] ?? DateTime.now().toIso8601String()),
      subjectName: json['subjectName'] ?? 'غير محدد',
      status: parsedStatus,
    );
  }
}
