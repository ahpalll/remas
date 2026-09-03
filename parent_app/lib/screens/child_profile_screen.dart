import 'package:flutter/material.dart';
import '../models/parent_child.dart';

class ChildProfileScreen extends StatelessWidget {
  final ParentChildDTO child;
  const ChildProfileScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('ملف الطالب: ${child.fullName}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Card(
          elevation: 3,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Column(
                    children: [
                      const CircleAvatar(
                        radius: 40,
                        backgroundColor: Colors.indigo,
                        child: Icon(Icons.school, size: 40, color: Colors.white),
                      ),
                      const SizedBox(height: 12),
                      Text(child.fullName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      Text('كود الطالب: ${child.studentCode}', style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
                const Divider(height: 32),
                _buildRow(Icons.school, 'المرحلة الدراسية', child.stageName),
                _buildRow(Icons.group, 'المجموعة الحالية', child.groupName ?? 'غير محدد'),
                _buildRow(Icons.grade, 'آخر نسبة درجات', '${child.recentGradePercentage ?? 0.0}%'),
                _buildRow(Icons.check_circle, 'نسبة الحضور', '${child.attendancePercentage ?? 0.0}%'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRow(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: Colors.indigo),
          const SizedBox(width: 12),
          Text('$title: ', style: const TextStyle(fontWeight: FontWeight.bold)),
          Expanded(child: Text(value, style: const TextStyle(color: Colors.black87))),
        ],
      ),
    );
  }
}
