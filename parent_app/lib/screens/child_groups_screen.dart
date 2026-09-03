import 'package:flutter/material.dart';
import '../models/parent_group.dart';
import '../services/parent_data_service.dart';

class ChildGroupsScreen extends StatefulWidget {
  final ParentDataService dataService;
  final String childId;
  const ChildGroupsScreen({super.key, required this.dataService, required this.childId});

  @override
  State<ChildGroupsScreen> createState() => _ChildGroupsScreenState();
}

class _ChildGroupsScreenState extends State<ChildGroupsScreen> {
  List<ParentGroupDTO> _groups = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    final list = await widget.dataService.fetchChildGroups(widget.childId);
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
      appBar: AppBar(title: const Text('مجموعات ومواد الطالب')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _groups.length,
              itemBuilder: (context, index) {
                final grp = _groups[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.class_, color: Colors.indigo, size: 36),
                    title: Text(grp.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('المادة: ${grp.subjectName} • المدرس: ${grp.teacherName}'),
                    trailing: Text(grp.roomName ?? '', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo)),
                  ),
                );
              },
            ),
    );
  }
}
