import 'package:flutter/material.dart';
import '../models/parent_schedule.dart';
import '../services/parent_data_service.dart';

class ChildScheduleScreen extends StatefulWidget {
  final ParentDataService dataService;
  final String childId;
  const ChildScheduleScreen({super.key, required this.dataService, required this.childId});

  @override
  State<ChildScheduleScreen> createState() => _ChildScheduleScreenState();
}

class _ChildScheduleScreenState extends State<ChildScheduleScreen> {
  List<ParentScheduleItemDTO> _schedule = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    final list = await widget.dataService.fetchChildSchedule(widget.childId);
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
      appBar: AppBar(title: const Text('جدول مواعيد الطالب')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _schedule.length,
              itemBuilder: (context, index) {
                final item = _schedule[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.schedule, color: Colors.indigo, size: 36),
                    title: Text('${item.subjectName} — ${item.dayOfWeek}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('الوقت: ${item.startTime} - ${item.endTime}'),
                    trailing: Chip(
                      label: Text(item.roomName ?? 'القاعة'),
                      backgroundColor: Colors.indigo.shade50,
                    ),
                  ),
                );
              },
            ),
    );
  }
}
