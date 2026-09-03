import 'package:flutter/material.dart';
import '../models/student_profile.dart';
import '../services/student_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final StudentService _studentService = StudentService();
  StudentProfileDTO? _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final p = await _studentService.fetchCurrentStudentProfile();
    if (mounted) {
      setState(() {
        _profile = p;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي للطالب'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _profile == null
              ? const Center(child: Text('تعذر تحميل بيانات الملف الشخصي.'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      const CircleAvatar(
                        radius: 45,
                        backgroundColor: Colors.deepPurple,
                        child: Icon(Icons.person, size: 50, color: Colors.white),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _profile!.fullName,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'كود الطالب: ${_profile!.studentCode}',
                        style: const TextStyle(fontSize: 16, color: Colors.deepPurple, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 16),
                      Card(
                        elevation: 2,
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              _buildInfoRow('البريد الإلكتروني', _profile!.email, Icons.email),
                              const Divider(),
                              _buildInfoRow('رقم الهاتف', _profile!.phone, Icons.phone),
                              const Divider(),
                              _buildInfoRow('المرحلة الدراسية', _profile!.stageName, Icons.school),
                              const Divider(),
                              _buildInfoRow('حالة الحساب', _profile!.status, Icons.verified_user),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Card(
                        elevation: 2,
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('المواد الدراسية المسجلة:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: _profile!.enrolledSubjectNames
                                    .map((subj) => Chip(
                                          label: Text(subj),
                                          backgroundColor: Colors.purple.shade50,
                                        ))
                                    .toList(),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: Colors.deepPurple),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
