import 'package:flutter/material.dart';
import '../models/student_schedule.dart';
import '../services/student_service.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  final StudentService _studentService = StudentService();
  List<StudentScheduleItemDTO> _schedule = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    final list = await _studentService.fetchStudentSchedule();
    if (mounted) {
      setState(() {
        _schedule = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الجدول الدراسي الأسبوعي'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _schedule.isEmpty
              ? const Center(child: Text('لا توجد مواعيد دراسية مسجلة.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16.0),
                  itemCount: _schedule.length,
                  itemBuilder: (context, index) {
                    final item = _schedule[index];
                    return Card(
                      elevation: 2,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.orange.shade100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                item.dayOfWeek,
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.subjectName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  Text('المعلم: ${item.teacherName}', style: const TextStyle(color: Colors.grey)),
                                  Text('القاعة: ${item.roomName}', style: const TextStyle(color: Colors.grey)),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(item.startTime, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                                const Text('إلى', style: TextStyle(fontSize: 10, color: Colors.grey)),
                                Text(item.endTime, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
