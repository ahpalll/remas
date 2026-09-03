enum AttendanceStatus { present, absent, late }

class ParentAttendanceRecordDTO {
  final String id;
  final String subjectName;
  final DateTime sessionDate;
  final AttendanceStatus status;

  ParentAttendanceRecordDTO({
    required this.id,
    required this.subjectName,
    required this.sessionDate,
    required this.status,
  });

  factory ParentAttendanceRecordDTO.fromJson(Map<String, dynamic> json) {
    AttendanceStatus parsed = AttendanceStatus.absent;
    final st = json['status'] ?? 'ABSENT';
    if (st == 'PRESENT') parsed = AttendanceStatus.present;
    if (st == 'LATE') parsed = AttendanceStatus.late;

    return ParentAttendanceRecordDTO(
      id: json['id'] ?? '',
      subjectName: json['subjectName'] ?? '',
      sessionDate: json['sessionDate'] != null ? DateTime.parse(json['sessionDate']) : DateTime.now(),
      status: parsed,
    );
  }
}
