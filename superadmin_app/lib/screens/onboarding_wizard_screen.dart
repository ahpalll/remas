import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

class OnboardingWizardScreen extends StatefulWidget {
  const OnboardingWizardScreen({super.key});

  @override
  State<OnboardingWizardScreen> createState() => _OnboardingWizardScreenState();
}

class _OnboardingWizardScreenState extends State<OnboardingWizardScreen> {
  int _currentStep = 0;
  bool _loading = false;

  // Step 1: Center Info
  final _centerNameCtrl = TextEditingController();
  final _centerPhoneCtrl = TextEditingController();
  final _centerEmailCtrl = TextEditingController();
  final _centerAddressCtrl = TextEditingController();
  String _centerType = 'center';

  // Step 2: Owner Info
  final _ownerEmailCtrl = TextEditingController();
  final _ownerPhoneCtrl = TextEditingController();

  // Step 3: License Info
  String _licensePlan = 'PRO';
  int _licenseDays = 365;

  // Step 5 Result
  InstitutionRecord? _createdInstitution;
  OwnerInvitationRecord? _createdInvitation;
  LicenseRecord? _createdLicense;
  String _tempPassword = '';

  @override
  void dispose() {
    _centerNameCtrl.dispose();
    _centerPhoneCtrl.dispose();
    _centerEmailCtrl.dispose();
    _centerAddressCtrl.dispose();
    _ownerEmailCtrl.dispose();
    _ownerPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitWizard() async {
    setState(() => _loading = true);
    try {
      final invCode = SuperAdminService.generateCsprngInvitationCode();
      final tempPassword = SuperAdminService.generateTemporaryPassword();

      // 1. Create Institution with ownerInvitationCode
      final inst = await SuperAdminService.createInstitution(
        name: _centerNameCtrl.text,
        type: _centerType,
        phone: _centerPhoneCtrl.text,
        email: _centerEmailCtrl.text,
        ownerEmail: _ownerEmailCtrl.text,
        ownerInvitationCode: invCode,
        address: _centerAddressCtrl.text,
      );

      // 2. Create Owner Invitation with invitationCode
      final inv = await SuperAdminService.createOwnerInvitation(
        institutionId: inst.institutionId,
        email: _ownerEmailCtrl.text,
        phone: _ownerPhoneCtrl.text,
        invitationCode: invCode,
      );

      // 3. Create License
      final lic = await SuperAdminService.createLicense(
        institutionId: inst.institutionId,
        plan: _licensePlan,
        durationDays: _licenseDays,
      );

      // 4. Provision Owner Firebase Auth Account via Secondary Auth instance
      final ownerUid = await SuperAdminService.provisionOwnerAuthAccount(
        ownerEmail: _ownerEmailCtrl.text,
        tempPassword: tempPassword,
      );

      // 5. Create Owner User Profile & Link Institution
      await SuperAdminService.createOwnerUserProfile(
        ownerUid: ownerUid,
        ownerEmail: _ownerEmailCtrl.text,
        ownerName: _centerNameCtrl.text,
        ownerPhone: _ownerPhoneCtrl.text,
        institutionId: inst.institutionId,
      );

      setState(() {
        _createdInstitution = inst;
        _createdInvitation = inv;
        _createdLicense = lic;
        _tempPassword = tempPassword;
        _currentStep = 4; // Move to Complete screen
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('خطأ أثناء تهيئة المركز: ${e.toString()}'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('الخطوة 1: بيانات المركز التعليمي', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(
          controller: _centerNameCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'اسم المركز / المؤسسة *',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _centerType,
          dropdownColor: const Color(0xFF1E293B),
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'نوع المؤسسة',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'center', child: Text('مركز تعليمي / سنتر')),
            DropdownMenuItem(value: 'school', child: Text('مدرسة خاصة')),
            DropdownMenuItem(value: 'academy', child: Text('أكاديمية تدريب')),
          ],
          onChanged: (val) => setState(() => _centerType = val ?? 'center'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _centerPhoneCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'رقم الهاتف',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _centerEmailCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'البريد الإلكتروني الرسمي للمركز',
            helperText: 'يستخدم كبيانات اتصال ومراسلات رسمية للمركز، وليس بالضرورة بريد تسجيل دخول المالك.',
            helperStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _centerAddressCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'العنوان التفصيلي',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('الخطوة 2: بيانات مالك المركز (Center Owner)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(
          controller: _ownerEmailCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'البريد الإلكتروني لمالك المركز *',
            helperText: 'سيُستخدم هذا البريد لاحقاً كحساب تسجيل الدخول الرسمي لمالك المركز في تطبيق Center Desktop.',
            helperStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _ownerPhoneCtrl,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'رقم هاتف المالك',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF0284C7).withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF38BDF8)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline, color: Color(0xFF38BDF8)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'سيتم إنشاء كود دعوة مشفر وتأسيس المركز تلقائياً (Zero-CLI). يدخل المالك كود الدعوة في تطبيق Center Desktop للتسجيل والتفعيل المباشر.',
                  style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('الخطوة 3: ترخيص التشغيل (License)', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _licensePlan,
          dropdownColor: const Color(0xFF1E293B),
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'باقة الاشتراك (Plan)',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'STANDARD', child: Text('Standard — قياسي')),
            DropdownMenuItem(value: 'PRO', child: Text('Pro — احترافي')),
            DropdownMenuItem(value: 'ENTERPRISE', child: Text('Enterprise — للمؤسسات الكبرى')),
          ],
          onChanged: (val) => setState(() => _licensePlan = val ?? 'PRO'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<int>(
          value: _licenseDays,
          dropdownColor: const Color(0xFF1E293B),
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'مدة الترخيص',
            labelStyle: TextStyle(color: Color(0xFF94A3B8)),
            filled: true,
            fillColor: Color(0xFF1E293B),
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 30, child: Text('شهر واحد (30 يوم)')),
            DropdownMenuItem(value: 90, child: Text('3 أشهر (90 يوم)')),
            DropdownMenuItem(value: 365, child: Text('سنة كاملة (365 يوم)')),
          ],
          onChanged: (val) => setState(() => _licenseDays = val ?? 365),
        ),
      ],
    );
  }

  Widget _buildStep4() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('الخطوة 4: مراجعة بيانات التهيئة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('🏛️ المركز: ${_centerNameCtrl.text}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text('نوع المركز: $_centerType', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
              Text('الهاتف: ${_centerPhoneCtrl.text}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
              const Divider(color: Color(0xFF334155)),
              Text('👤 مالك المركز: ${_ownerEmailCtrl.text}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text('هاتف المالك: ${_ownerPhoneCtrl.text}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
              const Divider(color: Color(0xFF334155)),
              Text('🔑 الترخيص: $_licensePlan Plan ($_licenseDays يوم)', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep5Complete() {
    final invCode = _createdInvitation?.invitationCode ?? _createdInstitution?.ownerInvitationCode ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF166534).withOpacity(0.3),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF22C55E)),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 32),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'CENTER CREATED — تم إنشاء المركز وحزمة الدعوة بنجاح (Zero-CLI)',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('اسم المركز: ${_createdInstitution?.name}', style: const TextStyle(color: Colors.white, fontSize: 14)),
              const SizedBox(height: 4),
              SelectableText('Institution ID: ${_createdInstitution?.institutionId}', style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('بريد المالك: ${_createdInvitation?.ownerEmail}', style: const TextStyle(color: Colors.white, fontSize: 14)),
              Text('حالة دعوة المالك: PENDING', style: const TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('معرف الترخيص: ${_createdLicense?.licenseId}', style: const TextStyle(color: Colors.white, fontSize: 14)),
              Text('كود الترخيص: ${_createdLicense?.licenseCode}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 13)),
              Text('حالة الترخيص: ${_createdLicense?.status}', style: const TextStyle(color: Color(0xFF22C55E), fontSize: 13)),
              Text('ربط الجهاز: NOT BOUND (سيتم الربط عند أول دخول للـ Desktop)', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text('🔐 بيانات دخول مالك المركز (Temporary Credentials):', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFF10B981)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SelectableText('البريد الإلكتروني: ${_createdInvitation?.ownerEmail}', style: const TextStyle(color: Colors.white, fontSize: 13)),
              const SizedBox(height: 4),
              SelectableText('كلمة المرور المؤقتة: $_tempPassword', style: const TextStyle(color: Color(0xFF10B981), fontFamily: 'monospace', fontSize: 15, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () {
                  final text = 'بيانات دخول مركز ${_createdInstitution?.name ?? ""}\nالبريد الإلكتروني: ${_createdInvitation?.ownerEmail ?? ""}\nكلمة المرور المؤقتة: $_tempPassword\nكود الدعوة: $invCode';
                  Clipboard.setData(ClipboardData(text: text));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ بيانات الدخول الحافظة')));
                },
                icon: const Icon(Icons.copy, size: 16),
                label: const Text('نسخ بيانات الدخول'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text('🔑 كود دعوة المالك لتسجيل الدخول (Owner Invitation Code):', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFF38BDF8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SelectableText(invCode, style: const TextStyle(color: Color(0xFF38BDF8), fontFamily: 'monospace', fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: invCode));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ كود الدعوة للحافظة')));
                },
                icon: const Icon(Icons.copy, size: 16),
                label: const Text('نسخ كود الدعوة'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3B82F6)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Center(
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12)),
            child: const Text('إغلاق والعودة للقائمة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('🚀 معالج تهيئة مركز جديد (Onboarding Wizard)'),
        backgroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (_currentStep < 4) ...[
              // Step indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: List.generate(4, (index) {
                  final isCurrent = index == _currentStep;
                  final isPassed = index < _currentStep;
                  return CircleAvatar(
                    radius: 16,
                    backgroundColor: isCurrent 
                        ? const Color(0xFF38BDF8) 
                        : (isPassed ? const Color(0xFF10B981) : const Color(0xFF334155)),
                    child: Text('${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  );
                }),
              ),
              const SizedBox(height: 24),
              if (_currentStep == 0) _buildStep1(),
              if (_currentStep == 1) _buildStep2(),
              if (_currentStep == 2) _buildStep3(),
              if (_currentStep == 3) _buildStep4(),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (_currentStep > 0)
                    OutlinedButton(
                      onPressed: _loading ? null : () => setState(() => _currentStep--),
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF64748B))),
                      child: const Text('السابق', style: TextStyle(color: Colors.white)),
                    )
                  else
                    const SizedBox.shrink(),
                  if (_currentStep < 3)
                    ElevatedButton(
                      onPressed: () {
                        if (_currentStep == 0 && _centerNameCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('يرجى إدخال اسم المركز')));
                          return;
                        }
                        if (_currentStep == 1 && _ownerEmailCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('يرجى إدخال بريد مالك المركز')));
                          return;
                        }
                        setState(() => _currentStep++);
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
                      child: const Text('التالي', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    )
                  else
                    ElevatedButton(
                      onPressed: _loading ? null : _submitWizard,
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                      child: _loading 
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                          : const Text('تأكيد وإنشاء المركز', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
            ] else
              _buildStep5Complete(),
          ],
        ),
      ),
    );
  }
}
