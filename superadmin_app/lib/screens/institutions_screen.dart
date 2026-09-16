import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/screens/onboarding_wizard_screen.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class InstitutionsScreen extends StatefulWidget {
  const InstitutionsScreen({super.key});

  @override
  State<InstitutionsScreen> createState() => _InstitutionsScreenState();
}

class _InstitutionsScreenState extends State<InstitutionsScreen> {
  List<InstitutionRecord> _institutions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final list = await SuperAdminService.getInstitutions();
      setState(() => _institutions = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openOnboardingWizard() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const OnboardingWizardScreen()),
    );
    if (result == true) {
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('🏛️ إدارة المؤسسات المراكز التعليمية', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                ElevatedButton.icon(
                  onPressed: _openOnboardingWizard,
                  icon: const Icon(Icons.add_business, size: 18),
                  label: const Text('تهيئة مركز جديد'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                  : _institutions.isEmpty
                      ? const Center(child: Text('لا توجد مؤسسات مسجلة حالياً', style: TextStyle(color: Color(0xFF94A3B8))))
                      : ListView.builder(
                          itemCount: _institutions.length,
                          itemBuilder: (context, index) {
                            final inst = _institutions[index];
                            return Card(
                              color: const Color(0xFF1E293B),
                              margin: const EdgeInsets.only(bottom: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(inst.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: inst.status == 'ACTIVE' ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(inst.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    SelectableText('معرف المؤسسة: ${inst.institutionId}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                                    Text('نوع المؤسسة: ${inst.type}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    Text('الهاتف: ${inst.phone.isEmpty ? 'غير محدد' : inst.phone}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    Text('المالك: ${inst.ownerEmail.isEmpty ? "بانتظار التفعيل (PENDING_OWNER)" : inst.ownerEmail}', style: TextStyle(color: inst.ownerEmail.isEmpty ? const Color(0xFFFBBF24) : const Color(0xFF94A3B8), fontSize: 12)),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Chip(label: Text('${inst.studentCount} طالب'), backgroundColor: const Color(0xFF334155), labelStyle: const TextStyle(color: Colors.white, fontSize: 11)),
                                        const SizedBox(width: 8),
                                        Chip(label: Text('${inst.teacherCount} معلم'), backgroundColor: const Color(0xFF334155), labelStyle: const TextStyle(color: Colors.white, fontSize: 11)),
                                      ],
                                    ),
                                  ],
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
}
