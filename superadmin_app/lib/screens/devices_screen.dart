import 'package:flutter/material';
import 'package:superadmin_app/services/superadmin_service.dart';

class DevicesScreen extends StatelessWidget {
  const DevicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('💻 الأجهزة المرتبطة برخص السنتر', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: ListView(
                children: [
                  _buildDeviceCard(
                    context,
                    institutionId: 'inst_bootstrap_001',
                    deviceName: 'REMAS-DESKTOP-MAIN',
                    fingerprint: 'win_fp_080f9ac395b7eab3a499baf9436bd7ea240c8eaf2a377d68649978805646e8ae',
                    osVersion: 'Windows 11 Enterprise (10.0.22631)',
                    status: 'BOUND',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceCard(
    BuildContext context, {
    required String institutionId,
    required String deviceName,
    required String fingerprint,
    required String osVersion,
    required String status,
  }) {
    final maskedFp = fingerprint.length > 24 ? '${fingerprint.substring(0, 16)}...${fingerprint.substring(fingerprint.length - 8)}' : fingerprint;

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
                Text(deviceName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                Chip(label: Text(status), backgroundColor: const Color(0xFF166534), labelStyle: const TextStyle(color: Colors.white, fontSize: 10)),
              ],
            ),
            const SizedBox(height: 8),
            Text('المؤسسة: $institutionId', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            Text('نظام التشغيل: $osVersion', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            Text('معرف الجهاز المشفر (SHA-256): $maskedFp', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11)),
            const SizedBox(height: 12),

            Align(
              alignment: Alignment.centerLeft,
              child: ElevatedButton.icon(
                onPressed: () async {
                  try {
                    await SuperAdminService.unbindDevice(institutionId: institutionId, reason: 'فك ربط إداري عبر تطبيق الموبايل');
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم فك ربط الجهاز بنجاح')));
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                  }
                },
                icon: const Icon(Icons.link_off_rounded, size: 16),
                label: const Text('فك ربط الجهاز', style: TextStyle(fontSize: 12)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
