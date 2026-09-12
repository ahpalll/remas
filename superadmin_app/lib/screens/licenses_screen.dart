import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class LicensesScreen extends StatefulWidget {
  const LicensesScreen({super.key});

  @override
  State<LicensesScreen> createState() => _LicensesScreenState();
}

class _LicensesScreenState extends State<LicensesScreen> {
  List<LicenseRecord> _licenses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final list = await SuperAdminService.getLicenses();
      setState(() => _licenses = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleSuspend(String instId) async {
    try {
      await SuperAdminService.suspendLicense(institutionId: instId, reason: 'إيقاف إداري من تطبيق الموبايل');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم تعليق الترخيص بنجاح')));
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _handleRevoke(String instId) async {
    try {
      await SuperAdminService.revokeLicense(institutionId: instId, reason: 'إلغاء الترخيص بقرار من السوبر أدمن');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إلغاء الترخيص بنجاح')));
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
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
            const Text('🔑 إدارة التراخيص وتراخيص الأجهزة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                  : ListView.builder(
                      itemCount: _licenses.length,
                      itemBuilder: (context, index) {
                        final lic = _licenses[index];
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
                                    Text(lic.licenseCode, style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 14)),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: lic.status == 'ACTIVE' ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(lic.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text('المؤسسة: ${lic.institutionId}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                                Text('حالة الجهاز: ${lic.deviceBindingStatus}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    OutlinedButton(
                                      onPressed: () => _handleSuspend(lic.institutionId),
                                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFFBBF24))),
                                      child: const Text('تعليق', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 12)),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      onPressed: () => _handleRevoke(lic.institutionId),
                                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                                      child: const Text('إلغاء الترخيص', style: TextStyle(color: Colors.white, fontSize: 12)),
                                    ),
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
