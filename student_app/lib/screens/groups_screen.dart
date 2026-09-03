import 'package:flutter/material.dart';
import '../models/student_group.dart';
import '../services/student_service.dart';

class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key});

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  final StudentService _studentService = StudentService();
  List<StudentGroupDTO> _groups = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    final list = await _studentService.fetchStudentGroups();
    if (mounted) {
      setState(() {
        _groups = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المجموعات والمواد الدراسية'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _groups.isEmpty
              ? const Center(child: Text('لا توجد مجموعات دراسية مسجلة حالياً.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16.0),
                  itemCount: _groups.length,
                  itemBuilder: (context, index) {
                    final g = _groups[index];
                    return Card(
                      elevation: 2,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Colors.blueAccent,
                          child: Icon(Icons.group, color: Colors.white),
                        ),
                        title: Text(g.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text('المادة: ${g.subjectName}'),
                            Text('المعلم: ${g.teacherName}'),
                            Text('المكان: ${g.roomName}'),
                          ],
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(g.code, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue)),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
