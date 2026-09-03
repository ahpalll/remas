class StudentScheduleItemDTO {
  final String id;
  final String institutionId;
  final String subjectName;
  final String teacherName;
  final String roomName;
  final String dayOfWeek;
  final String startTime;
  final String endTime;

  StudentScheduleItemDTO({
    required this.id,
    required this.institutionId,
    required this.subjectName,
    required this.teacherName,
    required this.roomName,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
  });

  factory StudentScheduleItemDTO.fromJson(Map<String, dynamic> json) {
    return StudentScheduleItemDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      subjectName: json['subjectName'] ?? '',
      teacherName: json['teacherName'] ?? '',
      roomName: json['roomName'] ?? '',
      dayOfWeek: json['dayOfWeek'] ?? 'الأحد',
      startTime: json['startTime'] ?? '04:00 م',
      endTime: json['endTime'] ?? '06:00 م',
    );
  }
}
