class LessonDTO {
  final String id;
  final String institutionId;
  final String subjectId;
  final String? stageId;
  final String title;
  final String? description;
  final int lessonNumber;
  final int sortOrder;
  final String status;
  final int version;

  LessonDTO({
    required this.id,
    required this.institutionId,
    required this.subjectId,
    this.stageId,
    required this.title,
    this.description,
    required this.lessonNumber,
    required this.sortOrder,
    required this.status,
    required this.version,
  });

  factory LessonDTO.fromJson(Map<String, dynamic> json) {
    return LessonDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      subjectId: json['subjectId'] ?? '',
      stageId: json['stageId'],
      title: json['title'] ?? '',
      description: json['description'],
      lessonNumber: json['lessonNumber'] ?? 1,
      sortOrder: json['sortOrder'] ?? 1,
      status: json['status'] ?? 'DRAFT',
      version: json['version'] ?? 1,
    );
  }
}

class EducationalContentDTO {
  final String id;
  final String institutionId;
  final String lessonId;
  final String subjectId;
  final String? stageId;
  final String title;
  final String? description;
  final String contentType;
  final String status;
  final int sortOrder;
  final int? durationSeconds;
  final int? fileSizeBytes;
  final String? url;
  final String? videoProvider;

  String get type => contentType;

  EducationalContentDTO({
    required this.id,
    required this.institutionId,
    required this.lessonId,
    required this.subjectId,
    this.stageId,
    required this.title,
    this.description,
    required this.contentType,
    required this.status,
    required this.sortOrder,
    this.durationSeconds,
    this.fileSizeBytes,
    this.url,
    this.videoProvider,
  });

  factory EducationalContentDTO.fromJson(Map<String, dynamic> json) {
    return EducationalContentDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      lessonId: json['lessonId'] ?? '',
      subjectId: json['subjectId'] ?? '',
      stageId: json['stageId'],
      title: json['title'] ?? '',
      description: json['description'],
      contentType: json['contentType'] ?? json['type'] ?? 'DOCUMENT',
      status: json['status'] ?? 'DRAFT',
      sortOrder: json['sortOrder'] ?? 1,
      durationSeconds: json['durationSeconds'],
      fileSizeBytes: json['fileSizeBytes'],
      url: json['url']?.toString(),
      videoProvider: json['videoProvider']?.toString(),
    );
  }
}
