import 'package:flutter/material.dart';
import '../models/parent_attendance.dart';
import '../services/parent_data_service.dart';

class ChildAttendanceScreen extends StatefulWidget {
  final ParentDataService dataService;
  final String childId;
  const ChildAttendanceScreen({super.key, required this.dataService, required this.childId});

  @override
  State<ChildAttendanceScreen> createState() => _ChildAttendanceScreenState();
}

class _ChildAttendanceScreenState extends State<ChildAttendanceScreen> {
  List<ParentAttendanceRecordDTO> _records = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAttendance();
  }

  Future<void> _loadAttendance() async {
    final list = await widget.dataService.fetchChildAttendance(widget.childId);
    if (mounted) {
      setState(() {
        _records = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final presentCount = _records.where((r) => r.status == AttendanceStatus.present || r.status == AttendanceStatus.late).length;
    final total = _records.length;
    final pct = total > 0 ? (presentCount / total * 100).toStringAsFixed(1) : '100.0';

    return Scaffold(
      appBar: AppBar(title: const Text('سجل حضور الطالب')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.indigo.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.indigo.shade200),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          const Text('إجمالي الجلسات', style: TextStyle(color: Colors.grey)),
                          Text('$total', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      Column(
                        children: [
                          const Text('حضر / تأخير', style: TextStyle(color: Colors.grey)),
                          Text('$presentCount', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.green)),
                        ],
                      ),
                      Column(
                        children: [
                          const Text('نسبة الحضور', style: TextStyle(color: Colors.grey)),
                          Text('$pct%', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.indigo)),
                        ],
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _records.length,
                    itemBuilder: (context, index) {
                      final r = _records[index];
                      return Card(
                        elevation: 1,
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: Icon(
                            r.status == AttendanceStatus.present
                                ? Icons.check_circle
                                : (r.status == AttendanceStatus.late ? Icons.access_time : Icons.cancel),
                            color: r.status == AttendanceStatus.present
                                ? Colors.green
                                : (r.status == AttendanceStatus.late ? Colors.orange : Colors.red),
                          ),
                          title: Text(r.subjectName, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('التاريخ: ${r.sessionDate.toString().split(' ')[0]}'),
                          trailing: Text(
                            r.status == AttendanceStatus.present
                                ? 'حاضر'
                                : (r.status == AttendanceStatus.late ? 'متأخر' : 'غائب'),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: r.status == AttendanceStatus.present
                                  ? Colors.green
                                  : (r.status == AttendanceStatus.late ? Colors.orange : Colors.red),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
