import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  List<DeviceBindingRecord> _devices = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final list = await SuperAdminService.getDeviceBindings();
      setState(() => _devices = list);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleUnbind(String bindingId) async {
    try {
      await SuperAdminService.unbindDevice(bindingId: bindingId, reason: 'فك الارتباط بطلب السوبر أدمن');
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم فك ارتباط الجهاز بنجاح')));
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
            const Text('💻 إدارة أجهزة المراكز (Windows Device Bindings)', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                  : _devices.isEmpty
                      ? const Center(child: Text('لا توجد أجهزة مرتبطة حالياً في Firestore', style: TextStyle(color: Color(0xFF94A3B8))))
                      : ListView.builder(
                          itemCount: _devices.length,
                          itemBuilder: (context, index) {
                            final dev = _devices[index];
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
                                        Text(dev.deviceName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: dev.status == 'BOUND' ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(dev.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    SelectableText('المؤسسة: ${dev.institutionId}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
                                    SelectableText('بصمة الجهاز (Fingerprint): ${dev.deviceFingerprintHash}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                    Text('نظام التشغيل: ${dev.osVersion}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    Text('تاريخ الربط: ${dev.boundAt}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                                    const SizedBox(height: 12),
                                    if (dev.status == 'BOUND')
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: ElevatedButton.icon(
                                          onPressed: () => _handleUnbind(dev.bindingId),
                                          icon: const Icon(Icons.link_off, size: 16),
                                          label: const Text('فك ارتباط الجهاز'),
                                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
                                        ),
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
