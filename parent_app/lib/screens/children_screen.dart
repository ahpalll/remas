import 'package:flutter/material.dart';
import '../models/parent_child.dart';
import '../services/parent_data_service.dart';
import 'child_profile_screen.dart';

class ChildrenScreen extends StatefulWidget {
  final ParentDataService dataService;
  const ChildrenScreen({super.key, required this.dataService});

  @override
  State<ChildrenScreen> createState() => _ChildrenScreenState();
}

class _ChildrenScreenState extends State<ChildrenScreen> {
  List<ParentChildDTO> _children = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadChildren();
  }

  Future<void> _loadChildren() async {
    final list = await widget.dataService.fetchChildren();
    if (mounted) {
      setState(() {
        _children = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('قائمة الأبناء المرتبطين')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _children.length,
              itemBuilder: (context, index) {
                final child = _children[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Colors.indigo,
                      child: Icon(Icons.person, color: Colors.white),
                    ),
                    title: Text(child.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${child.stageName} • كود: ${child.studentCode}'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ChildProfileScreen(child: child),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
    );
  }
}
