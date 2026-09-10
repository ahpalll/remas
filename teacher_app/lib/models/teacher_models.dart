/// Teacher Profile Data Transfer Object
class TeacherProfileDTO {
  final String teacherId;
  final String fullName;
  final String email;
  final String phone;
  final List<String> subjects;
  final String institutionId;

  TeacherProfileDTO({
    required this.teacherId,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.subjects,
    required this.institutionId,
  });

  factory TeacherProfileDTO.fromJson(Map<String, dynamic> json) {
    return TeacherProfileDTO(
      teacherId: json['teacherId'] ?? json['uid'] ?? '',
      fullName: json['fullName'] ?? json['displayName'] ?? 'أستاذ',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      subjects: List<String>.from(json['subjects'] ?? []),
      institutionId: json['institutionId'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'teacherId': teacherId,
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'subjects': subjects,
        'institutionId': institutionId,
      };
}

/// Teacher Group Data Transfer Object
class TeacherGroupDTO {
  final String groupId;
  final String groupName;
  final String subjectId;
  final String subjectName;
  final String academicLevelId;
  final String levelName;
  final String room;
  final int enrolledCount;
  final int maxCapacity;
  final String scheduleSummary;

  TeacherGroupDTO({
    required this.groupId,
    required this.groupName,
    required this.subjectId,
    required this.subjectName,
    required this.academicLevelId,
    required this.levelName,
    required this.room,
    required this.enrolledCount,
    required this.maxCapacity,
    required this.scheduleSummary,
  });

  factory TeacherGroupDTO.fromJson(Map<String, dynamic> json) {
    return TeacherGroupDTO(
      groupId: json['groupId'] ?? '',
      groupName: json['groupName'] ?? '',
      subjectId: json['subjectId'] ?? '',
      subjectName: json['subjectName'] ?? '',
      academicLevelId: json['academicLevelId'] ?? '',
      levelName: json['levelName'] ?? '',
      room: json['room'] ?? '',
      enrolledCount: json['enrolledCount'] ?? 0,
      maxCapacity: json['maxCapacity'] ?? 30,
      scheduleSummary: json['scheduleSummary'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'groupId': groupId,
        'groupName': groupName,
        'subjectId': subjectId,
        'subjectName': subjectName,
        'academicLevelId': academicLevelId,
        'levelName': levelName,
        'room': room,
        'enrolledCount': enrolledCount,
        'maxCapacity': maxCapacity,
        'scheduleSummary': scheduleSummary,
      };
}

/// Teacher Session Data Transfer Object
class TeacherSessionDTO {
  final String sessionId;
  final String groupId;
  final String groupName;
  final String subjectId;
  final String subjectName;
  final String teacherId;
  final String date;
  final String startTime;
  final String endTime;
  final String room;
  final String status; // 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  final bool attendanceTaken;
  final int totalStudents;
  final int presentCount;
  final int lateCount;
  final int absentCount;
  final int excusedCount;

  TeacherSessionDTO({
    required this.sessionId,
    required this.groupId,
    required this.groupName,
    required this.subjectId,
    required this.subjectName,
    required this.teacherId,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.room,
    required this.status,
    required this.attendanceTaken,
    required this.totalStudents,
    required this.presentCount,
    required this.lateCount,
    required this.absentCount,
    required this.excusedCount,
  });

  factory TeacherSessionDTO.fromJson(Map<String, dynamic> json) {
    return TeacherSessionDTO(
      sessionId: json['sessionId'] ?? '',
      groupId: json['groupId'] ?? '',
      groupName: json['groupName'] ?? '',
      subjectId: json['subjectId'] ?? '',
      subjectName: json['subjectName'] ?? '',
      teacherId: json['teacherId'] ?? '',
      date: json['date'] ?? '',
      startTime: json['startTime'] ?? '',
      endTime: json['endTime'] ?? '',
      room: json['room'] ?? '',
      status: json['status'] ?? 'SCHEDULED',
      attendanceTaken: json['attendanceTaken'] ?? false,
      totalStudents: json['totalStudents'] ?? 0,
      presentCount: json['presentCount'] ?? 0,
      lateCount: json['lateCount'] ?? 0,
      absentCount: json['absentCount'] ?? 0,
      excusedCount: json['excusedCount'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'sessionId': sessionId,
        'groupId': groupId,
        'groupName': groupName,
        'subjectId': subjectId,
        'subjectName': subjectName,
        'teacherId': teacherId,
        'date': date,
        'startTime': startTime,
        'endTime': endTime,
        'room': room,
        'status': status,
        'attendanceTaken': attendanceTaken,
        'totalStudents': totalStudents,
        'presentCount': presentCount,
        'lateCount': lateCount,
        'absentCount': absentCount,
        'excusedCount': excusedCount,
      };
}

/// Teacher Student Item Data Transfer Object
class TeacherStudentDTO {
  final String studentId;
  final String studentCode;
  final String fullName;
  final String attendanceStatus; // 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'
  final String academicStatus;
  final String? avatarUrl;

  TeacherStudentDTO({
    required this.studentId,
    required this.studentCode,
    required this.fullName,
    this.attendanceStatus = 'PRESENT',
    this.academicStatus = 'ACTIVE',
    this.avatarUrl,
  });

  factory TeacherStudentDTO.fromJson(Map<String, dynamic> json) {
    return TeacherStudentDTO(
      studentId: json['studentId'] ?? '',
      studentCode: json['studentCode'] ?? '',
      fullName: json['fullName'] ?? '',
      attendanceStatus: json['attendanceStatus'] ?? 'PRESENT',
      academicStatus: json['academicStatus'] ?? 'ACTIVE',
      avatarUrl: json['avatarUrl'],
    );
  }

  TeacherStudentDTO copyWith({
    String? attendanceStatus,
  }) {
    return TeacherStudentDTO(
      studentId: studentId,
      studentCode: studentCode,
      fullName: fullName,
      attendanceStatus: attendanceStatus ?? this.attendanceStatus,
      academicStatus: academicStatus,
      avatarUrl: avatarUrl,
    );
  }

  Map<String, dynamic> toJson() => {
        'studentId': studentId,
        'studentCode': studentCode,
        'fullName': fullName,
        'attendanceStatus': attendanceStatus,
        'academicStatus': academicStatus,
        'avatarUrl': avatarUrl,
      };
}

/// Teacher Attendance Record Data Transfer Object
class TeacherAttendanceRecordDTO {
  final String sessionId;
  final String studentId;
  final String status; // 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'
  final String markedAt;
  final String? notes;

  TeacherAttendanceRecordDTO({
    required this.sessionId,
    required this.studentId,
    required this.status,
    required this.markedAt,
    this.notes,
  });

  factory TeacherAttendanceRecordDTO.fromJson(Map<String, dynamic> json) {
    return TeacherAttendanceRecordDTO(
      sessionId: json['sessionId'] ?? '',
      studentId: json['studentId'] ?? '',
      status: json['status'] ?? 'PRESENT',
      markedAt: json['markedAt'] ?? '',
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() => {
        'sessionId': sessionId,
        'studentId': studentId,
        'status': status,
        'markedAt': markedAt,
        'notes': notes,
      };
}

/// Teacher Grade Item Data Transfer Object
class TeacherGradeDTO {
  final String examId;
  final String examTitle;
  final String groupId;
  final String studentId;
  final String studentName;
  final double score;
  final double maxScore;
  final double percentage;
  final bool isFinalized;
  final String gradedAt;

  TeacherGradeDTO({
    required this.examId,
    required this.examTitle,
    required this.groupId,
    required this.studentId,
    required this.studentName,
    required this.score,
    required this.maxScore,
    required this.percentage,
    required this.isFinalized,
    required this.gradedAt,
  });

  factory TeacherGradeDTO.fromJson(Map<String, dynamic> json) {
    final double sc = (json['score'] as num?)?.toDouble() ?? 0.0;
    final double maxSc = (json['maxScore'] as num?)?.toDouble() ?? 100.0;
    final double pct = maxSc > 0 ? (sc / maxSc) * 100.0 : 0.0;
    return TeacherGradeDTO(
      examId: json['examId'] ?? '',
      examTitle: json['examTitle'] ?? '',
      groupId: json['groupId'] ?? '',
      studentId: json['studentId'] ?? '',
      studentName: json['studentName'] ?? '',
      score: sc,
      maxScore: maxSc,
      percentage: double.parse(pct.toStringAsFixed(1)),
      isFinalized: json['isFinalized'] ?? false,
      gradedAt: json['gradedAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'examId': examId,
        'examTitle': examTitle,
        'groupId': groupId,
        'studentId': studentId,
        'studentName': studentName,
        'score': score,
        'maxScore': maxScore,
        'percentage': percentage,
        'isFinalized': isFinalized,
        'gradedAt': gradedAt,
      };
}

/// Teacher Notification Item Data Transfer Object
class TeacherNotificationDTO {
  final String notificationId;
  final String title;
  final String body;
  final String timestamp;
  final bool isRead;
  final String type;

  TeacherNotificationDTO({
    required this.notificationId,
    required this.title,
    required this.body,
    required this.timestamp,
    required this.isRead,
    required this.type,
  });

  factory TeacherNotificationDTO.fromJson(Map<String, dynamic> json) {
    return TeacherNotificationDTO(
      notificationId: json['notificationId'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      timestamp: json['timestamp'] ?? '',
      isRead: json['isRead'] ?? false,
      type: json['type'] ?? 'GENERAL',
    );
  }

  Map<String, dynamic> toJson() => {
        'notificationId': notificationId,
        'title': title,
        'body': body,
        'timestamp': timestamp,
        'isRead': isRead,
        'type': type,
      };
}
