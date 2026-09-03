class ParentScheduleItemDTO {
  final String id;
  final String subjectName;
  final String dayOfWeek;
  final String startTime;
  final String endTime;
  final String? roomName;

  ParentScheduleItemDTO({
    required this.id,
    required this.subjectName,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.roomName,
  });

  factory ParentScheduleItemDTO.fromJson(Map<String, dynamic> json) {
    return ParentScheduleItemDTO(
      id: json['id'] ?? '',
      subjectName: json['subjectName'] ?? '',
      dayOfWeek: json['dayOfWeek'] ?? '',
      startTime: json['startTime'] ?? '',
      endTime: json['endTime'] ?? '',
      roomName: json['roomName'],
    );
  }
}
