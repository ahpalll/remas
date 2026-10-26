import 'package:flutter/material.dart';
import '../models/student_profile.dart';
import '../services/student_service.dart';

/// Canonical identity surface:
/// - 0 memberships → NOT_LINKED deny state (never demo data)
/// - 1 membership → automatic resolution
/// - N memberships → real institution selector (runtime state only)
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final StudentService _studentService = StudentService();
  StudentProfileDTO? _profile;
  List<StudentProfileDTO> _memberships = [];
  bool _isLoading = true;
  String? _errorCode;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorCode = null;
      _errorMessage = null;
    });
    try {
      final p = await _studentService.fetchCurrentStudentProfile();
      if (!mounted) return;
      setState(() {
        _profile = p;
        _isLoading = false;
      });
    } on StudentResolutionException catch (e) {
      if (!mounted) return;
      if (e.code == 'MULTIPLE_MEMBERSHIPS') {
        final all = await _studentService.fetchStudentMemberships();
        if (!mounted) return;
        setState(() {
          _memberships = all;
          _errorCode = e.code;
          _errorMessage = e.message;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorCode = e.code;
          _errorMessage = e.message;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _selectMembership(StudentProfileDTO m) async {
    _studentService.setActiveMembership(m);
    await _loadProfile();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي للطالب'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorCode == 'MULTIPLE_MEMBERSHIPS'
              ? _buildSelector()
              : _errorMessage != null
                  ? _buildError()
                  : _profile == null
                      ? const Center(
                          child: Text('لا توجد بيانات متاحة حاليًا.'))
                      : _buildProfile(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.block, size: 48, color: Colors.redAccent),
            const SizedBox(height: 12),
            Text(_errorMessage ?? 'لا توجد بيانات متاحة حاليًا.',
                textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text('($_errorCode)',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadProfile,
              child: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSelector() {
    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: _memberships.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'اختر المؤسسة التعليمية:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          );
        }
        final m = _memberships[index - 1];
        return Card(
          elevation: 2,
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.school)),
            title: Text(m.fullName,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(
                'المؤسسة: ${m.institutionId}\nالكود: ${m.studentCode}'),
            onTap: () => _selectMembership(m),
          ),
        );
      },
    );
  }

  Widget _buildProfile() {
    return SingleChildScrollView(
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
            style: const TextStyle(
                fontSize: 16,
                color: Colors.deepPurple,
                fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          // Digital Student ID Card for Center Attendance Scanning
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.badge, color: Color(0xFF38BDF8), size: 20),
                        SizedBox(width: 6),
                        Text(
                          'بطاقة الطالب الذكية',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF10B981), width: 0.8),
                      ),
                      child: Text(
                        _profile!.status == 'ACTIVE' ? 'نشط' : _profile!.status,
                        style: const TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          26,
                          (i) => Container(
                            margin: const EdgeInsets.symmetric(horizontal: 1.5),
                            width: (i % 3 == 0) ? 3.5 : (i % 2 == 0 ? 2 : 1),
                            height: 42,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _profile!.studentCode.isNotEmpty ? _profile!.studentCode : _profile!.id,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 3,
                          color: Colors.black87,
                        ),
                      ),
                      const Text(
                        'امسح هذا الرمز لتسجيل الحضور في السنتر',
                        style: TextStyle(fontSize: 10, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  _buildInfoRow('كود الطالب', _profile!.studentCode, Icons.qr_code_2),
                  const Divider(),
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
                  const Text('المواد الدراسية المسجلة:',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  _profile!.enrolledSubjectNames.isEmpty
                      ? const Text('لا توجد بيانات متاحة حاليًا.')
                      : Wrap(
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
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, color: Colors.deepPurple),
          const SizedBox(width: 12),
          Text(label,
              style: const TextStyle(
                  color: Colors.grey, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
