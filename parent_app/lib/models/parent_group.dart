class ParentGroupDTO {
  final String id;
  final String name;
  final String subjectName;
  final String teacherName;
  final String? roomName;

  ParentGroupDTO({
    required this.id,
    required this.name,
    required this.subjectName,
    required this.teacherName,
    this.roomName,
  });

  factory ParentGroupDTO.fromJson(Map<String, dynamic> json) {
    return ParentGroupDTO(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      subjectName: json['subjectName'] ?? '',
      teacherName: json['teacherName'] ?? '',
      roomName: json['roomName'],
    );
  }
}
