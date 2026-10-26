import 'package:flutter/material.dart';
import '../models/student_attendance.dart';
import '../services/student_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final StudentService _studentService = StudentService();
  List<StudentAttendanceRecordDTO> _records = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
      });
    }
    final list = await _studentService.fetchStudentAttendanceHistory();
    if (mounted) {
      setState(() {
        _records = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _records.length;
    final presentCount = _records.where((r) => r.status == AttendanceRecordStatus.present).length;
    final lateCount = _records.where((r) => r.status == AttendanceRecordStatus.late).length;
    final absentCount = _records.where((r) => r.status == AttendanceRecordStatus.absent).length;
    final pct = total > 0 ? ((presentCount + lateCount) / total * 100).toStringAsFixed(1) : '0.0';

    return Scaffold(
      appBar: AppBar(
        title: const Text('سجل الحضور والغياب'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAttendance,
              child: Column(
                children: [
                  Container(
                    color: Colors.green.shade50,
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStatTile('نسبة الحضور', '$pct%', Colors.green),
                        _buildStatTile('حاضر', '$presentCount', Colors.blue),
                        _buildStatTile('متأخر', '$lateCount', Colors.orange),
                        _buildStatTile('غائب', '$absentCount', Colors.red),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _records.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 120),
                              Center(
                                  child: Text(
                                      'لا توجد بيانات متاحة حاليًا.\nاسحب للأسفل لإعادة المحاولة.')),
                            ],
                          )
                        : ListView.builder(
                          padding: const EdgeInsets.all(16.0),
                          itemCount: _records.length,
                          itemBuilder: (context, index) {
                            final rec = _records[index];
                            return Card(
                              elevation: 1,
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: Icon(
                                  rec.status == AttendanceRecordStatus.present
                                      ? Icons.check_circle
                                      : (rec.status == AttendanceRecordStatus.late ? Icons.access_time : Icons.cancel),
                                  color: rec.status == AttendanceRecordStatus.present
                                      ? Colors.green
                                      : (rec.status == AttendanceRecordStatus.late ? Colors.orange : Colors.red),
                                ),
                                title: Text(rec.subjectName, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text(rec.sessionDate.toString().split(' ').first),
                                trailing: Text(
                                  rec.status == AttendanceRecordStatus.present
                                      ? 'حاضر'
                                      : (rec.status == AttendanceRecordStatus.late ? 'متأخر' : 'غائب'),
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: rec.status == AttendanceRecordStatus.present
                                        ? Colors.green
                                        : (rec.status == AttendanceRecordStatus.late ? Colors.orange : Colors.red),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStatTile(String label, String val, Color color) {
    return Column(
      children: [
        Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}
