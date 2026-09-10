import 'package:flutter/material.dart';
import '../models/teacher_models.dart';
import '../services/teacher_services.dart';

/// Arabic RTL Primary Dashboard Screen for Teacher Mobile App
class TeacherDashboardScreen extends StatefulWidget {
  final TeacherAuthService authService;
  final TeacherDataService dataService;

  const TeacherDashboardScreen({
    super.key,
    required this.authService,
    required this.dataService,
  });

  @override
  State<TeacherDashboardScreen> createState() => _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final teacher = widget.authService.currentTeacher;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(teacher != null ? 'أهلاً، ${teacher.fullName}' : 'تطبيق المعلم'),
          backgroundColor: Colors.indigo.shade800,
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              icon: const Icon(Icons.notifications_outlined),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => TeacherNotificationsScreen(dataService: widget.dataService),
                  ),
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () async {
                await widget.authService.logout();
                if (context.mounted) {
                  Navigator.pushReplacementNamed(context, '/login');
                }
              },
            ),
          ],
        ),
        body: IndexedStack(
          index: _selectedIndex,
          children: [
            _buildHomeTab(context),
            TeacherSessionsScreen(dataService: widget.dataService, authService: widget.authService),
            TeacherGroupsScreen(dataService: widget.dataService),
            TeacherScheduleScreen(dataService: widget.dataService),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          selectedItemColor: Colors.indigo.shade800,
          unselectedItemColor: Colors.grey.shade600,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'الرئيسية'),
            BottomNavigationBarItem(icon: Icon(Icons.class_), label: 'الحصص'),
            BottomNavigationBarItem(icon: Icon(Icons.group), label: 'المجموعات'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'الجدول'),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeTab(BuildContext context) {
    final teacher = widget.authService.currentTeacher;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Card
          Card(
            color: Colors.indigo.shade50,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.indigo.shade800,
                    child: const Icon(Icons.person, color: Colors.white, size: 32),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          teacher?.fullName ?? 'أستاذ المركز',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'المواد: ${teacher?.subjects.join('، ') ?? 'الرياضيات'}',
                          style: TextStyle(color: Colors.grey.shade700, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Action Shortcuts
          const Text('العمليات السريعة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildShortcutCard(
                  context,
                  title: 'حضور اليوم',
                  icon: Icons.qr_code_scanner,
                  color: Colors.teal,
                  onTap: () => setState(() => _selectedIndex = 1),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildShortcutCard(
                  context,
                  title: 'رصد الدرجات',
                  icon: Icons.edit_note,
                  color: Colors.amber.shade800,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => TeacherGradesScreen(
                          dataService: widget.dataService,
                          authService: widget.authService,
                          groupId: 'group_math_101',
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Today's Sessions Preview
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('حصص اليوم', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              TextButton(
                onPressed: () => setState(() => _selectedIndex = 1),
                child: const Text('عرض الكل'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          FutureBuilder<List<TeacherSessionDTO>>(
            future: widget.dataService.fetchAssignedSessions(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              final sessions = snapshot.data ?? [];
              if (sessions.isEmpty) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Text('لا توجد حصص مسجلة اليوم.'),
                  ),
                );
              }
              return Column(
                children: sessions.map((sess) => _buildSessionCard(context, sess)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildShortcutCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        color: color.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: color.withValues(alpha: 0.3)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 12.0),
          child: Column(
            children: [
              Icon(icon, size: 32, color: color),
              const SizedBox(height: 8),
              Text(title, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSessionCard(BuildContext context, TeacherSessionDTO session) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.indigo.shade100,
          child: Icon(Icons.school, color: Colors.indigo.shade800),
        ),
        title: Text(session.groupName, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('${session.subjectName} • ${session.room} (${session.startTime} - ${session.endTime})'),
        trailing: const Icon(Icons.chevron_left),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => SessionDetailsScreen(
                session: session,
                dataService: widget.dataService,
                authService: widget.authService,
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Assigned Sessions Screen
class TeacherSessionsScreen extends StatelessWidget {
  final TeacherDataService dataService;
  final TeacherAuthService authService;

  const TeacherSessionsScreen({
    super.key,
    required this.dataService,
    required this.authService,
  });

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('الحصص الدراسية المسندة')),
        body: FutureBuilder<List<TeacherSessionDTO>>(
          future: dataService.fetchAssignedSessions(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(child: Text('خطأ: ${snapshot.error}'));
            }
            final sessions = snapshot.data ?? [];
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: sessions.length,
              itemBuilder: (context, index) {
                final sess = sessions[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(sess.groupName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text('المادة: ${sess.subjectName} | القاعة: ${sess.room}'),
                        Text('الوقت: ${sess.startTime} - ${sess.endTime} | التاريخ: ${sess.date}'),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => TeacherAttendanceScreen(
                                      session: sess,
                                      dataService: dataService,
                                      authService: authService,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.how_to_reg, size: 18),
                              label: const Text('رصد الحضور'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.indigo.shade800,
                                foregroundColor: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => SessionDetailsScreen(
                                      session: sess,
                                      dataService: dataService,
                                      authService: authService,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.info_outline, size: 18),
                              label: const Text('التفاصيل'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Session Details Screen
class SessionDetailsScreen extends StatelessWidget {
  final TeacherSessionDTO session;
  final TeacherDataService dataService;
  final TeacherAuthService authService;

  const SessionDetailsScreen({
    super.key,
    required this.session,
    required this.dataService,
    required this.authService,
  });

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: Text(session.groupName)),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(session.groupName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const Divider(),
                      Text('المادة: ${session.subjectName}'),
                      Text('التاريخ: ${session.date}'),
                      Text('التوقيت: ${session.startTime} - ${session.endTime}'),
                      Text('القاعة: ${session.room}'),
                      Text('حالة الحصة: ${session.status}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => TeacherAttendanceScreen(
                        session: session,
                        dataService: dataService,
                        authService: authService,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.how_to_reg),
                label: const Text('الانتقال لرصد الحضور'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: Colors.indigo.shade800,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Attendance Recording Screen
class TeacherAttendanceScreen extends StatefulWidget {
  final TeacherSessionDTO session;
  final TeacherDataService dataService;
  final TeacherAuthService authService;

  const TeacherAttendanceScreen({
    super.key,
    required this.session,
    required this.dataService,
    required this.authService,
  });

  @override
  State<TeacherAttendanceScreen> createState() => _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends State<TeacherAttendanceScreen> {
  List<TeacherStudentDTO> _students = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRoster();
  }

  Future<void> _loadRoster() async {
    final list = await widget.dataService.fetchGroupRoster(groupId: widget.session.groupId);
    setState(() {
      _students = list;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text('رصد الحضور - ${widget.session.groupName}'),
          actions: [
            IconButton(
              icon: const Icon(Icons.save),
              onPressed: _saveAttendance,
            ),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _students.length,
                itemBuilder: (context, index) {
                  final student = _students[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('كود الطالب: ${student.studentCode}'),
                      trailing: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'PRESENT', label: Text('حاضر')),
                          ButtonSegment(value: 'LATE', label: Text('متأخر')),
                          ButtonSegment(value: 'ABSENT', label: Text('غائب')),
                        ],
                        selected: {student.attendanceStatus},
                        onSelectionChanged: (Set<String> newSelection) {
                          setState(() {
                            _students[index] = student.copyWith(attendanceStatus: newSelection.first);
                          });
                        },
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  Future<void> _saveAttendance() async {
    final attendanceService = TeacherAttendanceService(authService: widget.authService);
    final records = _students
        .map((s) => TeacherAttendanceRecordDTO(
              sessionId: widget.session.sessionId,
              studentId: s.studentId,
              status: s.attendanceStatus,
              markedAt: DateTime.now().toIso8601String(),
            ))
        .toList();

    final res = await attendanceService.submitSessionAttendance(
      sessionId: widget.session.sessionId,
      targetTeacherId: widget.session.teacherId,
      records: records,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? 'تم الحفظ')),
      );
    }
  }
}

/// Assigned Groups Screen (View-Only)
class TeacherGroupsScreen extends StatelessWidget {
  final TeacherDataService dataService;

  const TeacherGroupsScreen({super.key, required this.dataService});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('المجموعات التعليمية المسندة')),
        body: FutureBuilder<List<TeacherGroupDTO>>(
          future: dataService.fetchAssignedGroups(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final groups = snapshot.data ?? [];
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: groups.length,
              itemBuilder: (context, index) {
                final grp = groups[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(grp.groupName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${grp.levelName} • ${grp.subjectName}\nعدد الطلاب: ${grp.enrolledCount} / ${grp.maxCapacity} | القاعة: ${grp.room}'),
                    isThreeLine: true,
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Teacher Schedule Screen
class TeacherScheduleScreen extends StatelessWidget {
  final TeacherDataService dataService;

  const TeacherScheduleScreen({super.key, required this.dataService});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('الجدول الأسبوعي')),
        body: FutureBuilder<List<TeacherSessionDTO>>(
          future: dataService.fetchAssignedSessions(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final sessions = snapshot.data ?? [];
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: sessions.length,
              itemBuilder: (context, index) {
                final sess = sessions[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.access_time_filled, color: Colors.indigo),
                    title: Text(sess.groupName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('الوقت: ${sess.startTime} - ${sess.endTime} | القاعة: ${sess.room}'),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Teacher Grades Screen
class TeacherGradesScreen extends StatefulWidget {
  final TeacherDataService dataService;
  final TeacherAuthService authService;
  final String groupId;

  const TeacherGradesScreen({
    super.key,
    required this.dataService,
    required this.authService,
    required this.groupId,
  });

  @override
  State<TeacherGradesScreen> createState() => _TeacherGradesScreenState();
}

class _TeacherGradesScreenState extends State<TeacherGradesScreen> {
  List<TeacherGradeDTO> _grades = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGrades();
  }

  Future<void> _loadGrades() async {
    final gradingService = TeacherGradingService(authService: widget.authService);
    final list = await gradingService.fetchAssessmentGrades(examId: 'exam_sep_01', groupId: widget.groupId);
    setState(() {
      _grades = list;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('رصد درجات الاختبارات')),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _grades.length,
                itemBuilder: (context, index) {
                  final g = _grades[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text(g.studentName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('الاختبار: ${g.examTitle}\nالدرجة: ${g.score} / ${g.maxScore} (${g.percentage}%)'),
                      trailing: IconButton(
                        icon: const Icon(Icons.edit),
                        onPressed: () {},
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

/// Teacher Notifications Screen
class TeacherNotificationsScreen extends StatelessWidget {
  final TeacherDataService dataService;

  const TeacherNotificationsScreen({super.key, required this.dataService});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('الإشعارات')),
        body: FutureBuilder<List<TeacherNotificationDTO>>(
          future: dataService.fetchNotifications(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final list = snapshot.data ?? [];
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (context, index) {
                final notif = list[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.notifications_active, color: Colors.amber),
                    title: Text(notif.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(notif.body),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
