import 'package:flutter/material.dart';
import '../models/subscription.dart';
import '../services/subscription_service.dart';
import '../services/student_service.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  final SubscriptionStudentService _subscriptionService = SubscriptionStudentService();
  final StudentService _studentService = StudentService();
  final TextEditingController _codeController = TextEditingController();
  List<StudentEntitlementDTO> _entitlements = [];
  bool _isLoading = true;
  bool _isRedeeming = false;
  String? _resultMessage;

  @override
  void initState() {
    super.initState();
    _loadEntitlements();
  }

  Future<void> _loadEntitlements() async {
    try {
      final profile = await _studentService.fetchCurrentStudentProfile();
      if (profile == null) {
        if (mounted) {
          setState(() {
            _entitlements = [];
            _isLoading = false;
          });
        }
        return;
      }
      final list = await _subscriptionService.fetchActiveEntitlements(
        institutionId: profile.institutionId,
      );
      if (mounted) {
        setState(() {
          _entitlements = list;
          _isLoading = false;
        });
      }
    } on StudentResolutionException catch (e) {
      if (mounted) {
        setState(() {
          _entitlements = [];
          _isLoading = false;
          _resultMessage = e.message;
        });
      }
    }
  }

  Future<void> _redeemCode() async {
    final rawCode = _codeController.text.trim();
    if (rawCode.isEmpty) {
      setState(() {
        _resultMessage = 'يرجى إدخال كود الاشتراك المكون من 16 حرفاً أو رقماً.';
      });
      return;
    }

    setState(() {
      _isRedeeming = true;
      _resultMessage = null;
    });

    final requestId = 'req_flutter_${DateTime.now().millisecondsSinceEpoch}';
    try {
      final result = await _subscriptionService.redeemCode(rawCode, requestId);
      if (!mounted) return;
      _codeController.clear(); // Zero plaintext code in UI input immediately
      setState(() {
        _isRedeeming = false;
        if (result != null) {
          _resultMessage = 'تم تفعيل كود الاشتراك بنجاح! الصلاحية نشطة حتى ${result.expiresAt.toString().split(' ').first}';
          _loadEntitlements();
        } else {
          _resultMessage = 'تعذر تفعيل الكود. يرجى التثبت من صحة الكود أو حالة الباقة.';
        }
      });
    } on SubscriptionException catch (e) {
      if (!mounted) return;
      _codeController.clear();
      setState(() {
        _isRedeeming = false;
        _resultMessage = e.message;
      });
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الاشتراكات وأكواد التفعيل'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Card(
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'تفعيل كود اشتراك جديد (Redeem Subscription Code)',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _codeController,
                            decoration: const InputDecoration(
                              labelText: 'كود الاشتراك (مثال: SUB-XXXX-XXXX-XXXX)',
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.qr_code),
                            ),
                            textCapitalization: TextCapitalization.characters,
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _isRedeeming ? null : _redeemCode,
                              icon: _isRedeeming
                                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.check_circle),
                              label: const Text('تفعيل الكود الآن'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                          if (_resultMessage != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              _resultMessage!,
                              style: TextStyle(
                                color: _resultMessage!.contains('نجاح') ? Colors.green.shade900 : Colors.red.shade900,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'الاشتراكات والصلاحيات الفعالة حالياً:',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _entitlements.isEmpty
                      ? const Text('لا توجد اشتراكات نشطة حالياً.')
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _entitlements.length,
                          itemBuilder: (context, index) {
                            final ent = _entitlements[index];
                            return Card(
                              elevation: 1,
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: const Icon(Icons.verified, color: Colors.green, size: 36),
                                title: Text('باقة الاشتراك: ${ent.packageId}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text('تنتهي في: ${ent.expiresAt.toString().split(' ').first}'),
                                trailing: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade50,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    ent.status,
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ],
              ),
            ),
    );
  }
}
