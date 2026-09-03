class StudentGradeDTO {
  final String id;
  final String institutionId;
  final String examName;
  final String subjectName;
  final double score;
  final double maxScore;
  final double percentage;
  final String status;
  final DateTime examDate;

  StudentGradeDTO({
    required this.id,
    required this.institutionId,
    required this.examName,
    required this.subjectName,
    required this.score,
    required this.maxScore,
    required this.percentage,
    required this.status,
    required this.examDate,
  });

  factory StudentGradeDTO.fromJson(Map<String, dynamic> json) {
    final double s = (json['score'] ?? 0.0).toDouble();
    final double m = (json['maxScore'] ?? 100.0).toDouble();
    final double pct = m > 0 ? (s / m) * 100 : 0.0;

    return StudentGradeDTO(
      id: json['id'] ?? '',
      institutionId: json['institutionId'] ?? '',
      examName: json['examName'] ?? 'اختبار',
      subjectName: json['subjectName'] ?? 'غير محدد',
      score: s,
      maxScore: m,
      percentage: pct,
      status: json['status'] ?? 'FINALIZED',
      examDate: DateTime.parse(json['examDate'] ?? DateTime.now().toIso8601String()),
    );
  }
}
