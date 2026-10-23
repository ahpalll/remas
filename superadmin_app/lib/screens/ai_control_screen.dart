import 'package:flutter/material.dart';
import 'package:superadmin_app/models/superadmin_models.dart';
import 'package:superadmin_app/services/ai_provider_service.dart';
import 'package:superadmin_app/services/superadmin_service.dart';

/// SuperAdmin Central AI Command Center (منبع الذكاء الاصطناعي المركزي وحوكمة السناتر).
/// 1. Tab 1: المنبع المركزي (Google Gemini Master Pool & Multi-Key Load Balancing).
/// 2. Tab 2: حوكمة وكوتة السناتر (Center Quotas, Features, and VIP Access Gating).
class AIControlScreen extends StatefulWidget {
  const AIControlScreen({super.key});

  @override
  State<AIControlScreen> createState() => _AIControlScreenState();
}

class _AIControlScreenState extends State<AIControlScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // ---------------- Master Pool State (Tab 1) ----------------
  bool _masterLoading = true;
  bool _masterSaving = false;
  String? _masterError;
  bool _masterEnabled = true;
  String _selectedModel = 'gemini-2.0-flash';
  List<String> _geminiKeys = [];
  final Map<int, bool> _keyRevealed = {};
  final Map<int, bool> _keyTesting = {};
  final Map<int, Map<String, dynamic>> _keyTestResults = {};
  final TextEditingController _newKeyController = TextEditingController();
  bool _testingNewKey = false;
  String? _newKeyError;
  bool _canBypassCheck = false;

  // ---------------- Center Governance State (Tab 2) ----------------
  List<InstitutionRecord> _institutions = [];
  String? _selectedInstitutionId;
  List<AiUsageRecord> _usage = [];
  bool _govLoading = true;
  bool _govSaving = false;
  String? _govError;

  bool _aiEnabled = false;
  bool _vipRequired = false;
  final TextEditingController _totalLimitController = TextEditingController(text: '5000');
  bool _tutorEnabled = true;
  final TextEditingController _tutorLimitController = TextEditingController(text: '100');
  bool _teacherEnabled = true;
  final TextEditingController _teacherLimitController = TextEditingController(text: '50');
  bool _featureEnabled = true;
  final TextEditingController _limitController = TextEditingController(text: '50');

  final List<String> _availableModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadMasterConfig();
    _loadInstitutions();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _newKeyController.dispose();
    _totalLimitController.dispose();
    _limitController.dispose();
    _tutorLimitController.dispose();
    _teacherLimitController.dispose();
    super.dispose();
  }

  // =========================================================================
  // Master Pool Logic
  // =========================================================================

  Future<void> _loadMasterConfig() async {
    setState(() {
      _masterLoading = true;
      _masterError = null;
    });
    try {
      final cfg = await SuperAdminService.getSystemAiMasterConfig();
      if (!mounted) return;
      setState(() {
        _masterEnabled = cfg.enabled;
        _selectedModel = _availableModels.contains(cfg.primaryModel)
            ? cfg.primaryModel
            : 'llama-3.3-70b-versatile';
        _geminiKeys = List<String>.from(cfg.geminiKeys);
        _masterLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _masterError = e.toString().replaceAll('Exception: ', '');
        _masterLoading = false;
      });
    }
  }

  Future<void> _saveMasterConfig() async {
    setState(() {
      _masterSaving = true;
      _masterError = null;
    });
    try {
      final sanitizedKeys = _geminiKeys
          .map((k) => AiProviderService.sanitizeApiKey(k))
          .where((k) => k.isNotEmpty)
          .toSet()
          .toList();

      await SuperAdminService.saveSystemAiMasterConfig(
        enabled: _masterEnabled,
        primaryModel: _selectedModel,
        geminiKeys: sanitizedKeys,
      );
      if (!mounted) return;
      setState(() => _geminiKeys = sanitizedKeys);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ تم حفظ إعدادات المنبع المركزي للذكاء الاصطناعي بنجاح'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _masterError = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _masterSaving = false);
    }
  }

  Future<void> _testKey(int index, String key) async {
    setState(() {
      _keyTesting[index] = true;
      _keyTestResults.remove(index);
    });
    final res = await AiProviderService.testAiKeyLive(
      apiKey: key,
      model: _selectedModel,
    );
    if (!mounted) return;
    setState(() {
      _keyTesting[index] = false;
      _keyTestResults[index] = res;
    });
  }

  Future<void> _addNewKey({bool force = false}) async {
    final rawKey = _newKeyController.text;
    final key = AiProviderService.sanitizeApiKey(rawKey);
    if (key.isEmpty) {
      setState(() {
        _newKeyError = 'يرجى إدخال مفتاح الـ API أولاً';
        _canBypassCheck = false;
      });
      return;
    }
    if (_geminiKeys.contains(key)) {
      setState(() {
        _newKeyError = 'هذا المفتاح مضاف مسبقاً في المجمع المركزي';
        _canBypassCheck = false;
      });
      return;
    }

    if (force) {
      setState(() {
        _geminiKeys.add(key);
        _newKeyController.clear();
        _testingNewKey = false;
        _newKeyError = null;
        _canBypassCheck = false;
        _keyTestResults[_geminiKeys.length - 1] = {
          'success': true,
          'latencyMs': 0,
          'warning': 'تمت إضافة المفتاح مباشرة دون فحص حي.',
        };
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚡ تم إضافة المفتاح للمجمع! اضغط "حفظ كافة التغييرات" لتثبيته في النظام.'),
          backgroundColor: Color(0xFF0284C7),
        ),
      );
      return;
    }

    setState(() {
      _testingNewKey = true;
      _newKeyError = null;
      _canBypassCheck = false;
    });

    final res = await AiProviderService.testAiKeyLive(
      apiKey: key,
      model: _selectedModel,
    );

    if (!mounted) return;

    if (res['success'] == true) {
      setState(() {
        _geminiKeys.add(key);
        _newKeyController.clear();
        _testingNewKey = false;
        _newKeyError = null;
        _canBypassCheck = false;
        _keyTestResults[_geminiKeys.length - 1] = res;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['warning'] != null
              ? '⚡ تم قبول المفتاح واعتماده (${res['model'] ?? 'AI'}) بنجاح! اضغط حفظ للاعتماد.'
              : '⚡ تم فحص المفتاح بنجاح (${res['latencyMs']}ms - ${res['model'] ?? 'AI'}) وإضافته للمجمع! اضغط حفظ للاعتماد.'),
          backgroundColor: const Color(0xFF0284C7),
        ),
      );
    } else {
      setState(() {
        _testingNewKey = false;
        _canBypassCheck = true;
        _newKeyError = res['error'] ?? 'فشل فحص صلاحية المفتاح، تحقق منه مجدداً';
      });
    }
  }

  void _removeKey(int index) {
    setState(() {
      _geminiKeys.removeAt(index);
      _keyRevealed.remove(index);
      _keyTestResults.remove(index);
    });
  }

  String _maskKey(String key) {
    if (key.length <= 8) return '••••••••';
    return '${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}';
  }

  // =========================================================================
  // Center Governance Logic
  // =========================================================================

  Future<void> _loadInstitutions() async {
    setState(() {
      _govLoading = true;
      _govError = null;
    });
    try {
      final list = await SuperAdminService.getInstitutions();
      if (!mounted) return;
      setState(() => _institutions = list);
      if (list.isNotEmpty) {
        _selectedInstitutionId = list.first.institutionId;
        await _loadGovernance();
      } else {
        setState(() => _govLoading = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _govError = e.toString().replaceAll('Exception: ', '');
        _govLoading = false;
      });
    }
  }

  Future<void> _loadGovernance() async {
    final instId = _selectedInstitutionId;
    if (instId == null || instId.isEmpty) return;
    setState(() {
      _govLoading = true;
      _govError = null;
    });
    try {
      final cfg = await SuperAdminService.getAiGovernance(institutionId: instId);
      final usage = await SuperAdminService.getAiUsage(institutionId: instId);
      if (!mounted) return;
      setState(() {
        _usage = usage;
        _aiEnabled = cfg.aiEnabled;
        _vipRequired = cfg.vipSubscriptionRequired;
        _totalLimitController.text = cfg.totalMonthlyLimit.toString();
        _featureEnabled = cfg.questionGenerationEnabled;
        _limitController.text = cfg.monthlyLimit.toString();
        _tutorEnabled = cfg.tutorEnabled;
        _tutorLimitController.text = cfg.tutorMonthlyLimit.toString();
        _teacherEnabled = cfg.teacherAssistantEnabled;
        _teacherLimitController.text = cfg.teacherMonthlyLimit.toString();
        _govLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _govError = e.toString().replaceAll('Exception: ', '');
        _govLoading = false;
      });
    }
  }

  Future<void> _saveGovernance() async {
    final instId = _selectedInstitutionId;
    if (instId == null || instId.isEmpty) return;

    final totalLimit = int.tryParse(_totalLimitController.text.trim());
    final qgLimit = int.tryParse(_limitController.text.trim());
    final tutorLimit = int.tryParse(_tutorLimitController.text.trim());
    final teacherLimit = int.tryParse(_teacherLimitController.text.trim());

    if (totalLimit == null || qgLimit == null || tutorLimit == null || teacherLimit == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('القيم المدخلة للحدود الشهرية يجب أن تكون أرقاماً صحيحة')),
      );
      return;
    }

    setState(() {
      _govSaving = true;
      _govError = null;
    });

    try {
      await SuperAdminService.saveAiGovernance(
        institutionId: instId,
        aiEnabled: _aiEnabled,
        questionGenerationEnabled: _featureEnabled,
        monthlyLimit: qgLimit,
        tutorEnabled: _tutorEnabled,
        tutorMonthlyLimit: tutorLimit,
        teacherAssistantEnabled: _teacherEnabled,
        teacherMonthlyLimit: teacherLimit,
        totalMonthlyLimit: totalLimit,
        vipSubscriptionRequired: _vipRequired,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ تم حفظ حوكمة وكوتة السنتر بنجاح'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _govError = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _govSaving = false);
    }
  }

  void _applyQuickQuota(int quota) {
    setState(() {
      _totalLimitController.text = quota.toString();
    });
  }

  // =========================================================================
  // UI Builders
  // =========================================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: const Text(
          '🤖 مركز التحكم الذكي والحوكمة',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF38BDF8),
          indicatorWeight: 3,
          labelColor: const Color(0xFF38BDF8),
          unselectedLabelColor: const Color(0xFF94A3B8),
          tabs: const [
            Tab(icon: Icon(Icons.hub_rounded), text: '⚡ المنبع المركزي (Gemini Hub)'),
            Tab(icon: Icon(Icons.admin_panel_settings_rounded), text: '🏢 كوتة وحوكمة السناتر'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMasterPoolTab(),
          _buildGovernanceTab(),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Tab 1: المنبع المركزي (Master Pool)
  // -------------------------------------------------------------------------
  Widget _buildMasterPoolTab() {
    if (_masterLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Emergency Master Switch Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _masterEnabled
                    ? [const Color(0xFF0F2B48), const Color(0xFF1E293B)]
                    : [const Color(0xFF3B1219), const Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _masterEnabled ? const Color(0xFF0284C7) : const Color(0xFFEF4444),
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    color: Color(0x330284C7),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _masterEnabled ? Icons.bolt_rounded : Icons.power_off_rounded,
                    color: _masterEnabled ? const Color(0xFF38BDF8) : const Color(0xFFF87171),
                    size: 30,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'المفتاح العام للذكاء الاصطناعي (Master Switch)',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _masterEnabled
                            ? '🟢 الخدمة مفعلة ومتاحة لكافة التطبيقات والسناتر'
                            : '🔴 تم إيقاف الخدمة طارئاً لكافة المنظومة بنقرة واحدة',
                        style: TextStyle(
                          color: _masterEnabled ? const Color(0xFF4ADE80) : const Color(0xFFFCA5A5),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _masterEnabled,
                  activeThumbColor: const Color(0xFF38BDF8),
                  activeTrackColor: const Color(0xFF0369A1),
                  onChanged: (val) => setState(() => _masterEnabled = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Primary Model Selector Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.memory_rounded, color: Color(0xFF38BDF8), size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'النموذج الذكي المعتمد (Gemini Model)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF065F46),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('100% مجاني وسريع', style: TextStyle(color: Color(0xFF6EE7B7), fontSize: 11)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedModel,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'llama-3.3-70b-versatile',
                      child: Text('⚡ Groq Llama 3.3 70B (الأساسي المجاني — فائق السرعة وبدون حظر 🟢)'),
                    ),
                    DropdownMenuItem(
                      value: 'llama-3.1-8b-instant',
                      child: Text('🚀 Groq Llama 3.1 8B (استجابة لحظية فائقة الخفة)'),
                    ),
                    DropdownMenuItem(
                      value: 'gemini-1.5-flash',
                      child: Text('🌐 Google Gemini 1.5 Flash (مستقر وسريع)'),
                    ),
                    DropdownMenuItem(
                      value: 'gemini-2.0-flash',
                      child: Text('⚡ Google Gemini 2.0 Flash (الأحدث من جوجل)'),
                    ),
                    DropdownMenuItem(
                      value: 'gemini-1.5-pro',
                      child: Text('🧠 Google Gemini 1.5 Pro (تحليلي متقدم)'),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedModel = val);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Multi-Key Pool Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.vpn_key_rounded, color: Color(0xFFFBBF24), size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'مجمع المفاتيح الذكي (Multi-Key Rotation Pool)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF38BDF8)),
                      ),
                      child: Text(
                        '${_geminiKeys.length} مفاتيح نشطة',
                        style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'يتم تدوير الطلبات بين هذه المفاتيح تلقائياً لمضاعفة سعة الطلبات المجانية ومنع أي توقف.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
                const Divider(color: Color(0xFF334155), height: 24),

                if (_geminiKeys.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF475569)),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.key_off_rounded, color: Color(0xFF94A3B8), size: 36),
                        SizedBox(height: 8),
                        Text(
                          'لا يوجد مفاتيح مضافة حتى الآن في المجمع المركزي',
                          style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 13),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'أضف مفتاح Gemini مجاني بالأسفل للبدء فوراً',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
                        ),
                      ],
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _geminiKeys.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, idx) {
                      final key = _geminiKeys[idx];
                      final isRevealed = _keyRevealed[idx] == true;
                      final isTesting = _keyTesting[idx] == true;
                      final testRes = _keyTestResults[idx];

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: testRes != null
                                ? (testRes['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626))
                                : const Color(0xFF334155),
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 12,
                                  backgroundColor: const Color(0xFF1E293B),
                                  child: Text(
                                    '${idx + 1}',
                                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: key.startsWith('gsk_') ? const Color(0x3310B981) : const Color(0x3338BDF8),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: key.startsWith('gsk_') ? const Color(0xFF10B981) : const Color(0xFF38BDF8)),
                                  ),
                                  child: Text(
                                    key.startsWith('gsk_') ? 'Groq' : 'Gemini',
                                    style: TextStyle(
                                      color: key.startsWith('gsk_') ? const Color(0xFF34D399) : const Color(0xFF38BDF8),
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    isRevealed ? key : _maskKey(key),
                                    style: TextStyle(
                                      color: isRevealed ? const Color(0xFFFBBF24) : Colors.white,
                                      fontFamily: 'monospace',
                                      fontSize: 13,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                IconButton(
                                  icon: Icon(
                                    isRevealed ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                    color: const Color(0xFF94A3B8),
                                    size: 18,
                                  ),
                                  onPressed: () => setState(() => _keyRevealed[idx] = !isRevealed),
                                  tooltip: isRevealed ? 'إخفاء' : 'إظهار',
                                ),
                                if (isTesting)
                                  const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () => _testKey(idx, key),
                                    icon: const Icon(Icons.network_ping_rounded, size: 14),
                                    label: const Text('فحص حي', style: TextStyle(fontSize: 11)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0369A1),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      minimumSize: Size.zero,
                                    ),
                                  ),
                                const SizedBox(width: 6),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFF87171), size: 20),
                                  onPressed: () => _removeKey(idx),
                                  tooltip: 'حذف المفتاح',
                                ),
                              ],
                            ),
                            if (testRes != null) ...[
                              const SizedBox(height: 6),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: testRes['success'] == true
                                      ? const Color(0x4D065F46)
                                      : const Color(0x4D7F1D1D),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      testRes['success'] == true ? Icons.check_circle_rounded : Icons.error_rounded,
                                      color: testRes['success'] == true ? const Color(0xFF4ADE80) : const Color(0xFFF87171),
                                      size: 14,
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        testRes['success'] == true
                                            ? 'المفتاح سليم ونشط — زمن الاستجابة: ${testRes['latencyMs']} ms'
                                            : 'فشل الفحص: ${testRes['error']}',
                                        style: TextStyle(
                                          color: testRes['success'] == true ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),

                const SizedBox(height: 16),
                const Text('إضافة مفتاح جديد إلى المجمع:', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 13, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _newKeyController,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'ألصق مفتاح Groq المجاني (gsk_...) أو مفتاح Gemini (AIzaSy...)',
                          hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                          filled: true,
                          fillColor: const Color(0xFF0F172A),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          errorText: _newKeyError,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      onPressed: _testingNewKey ? null : () => _addNewKey(),
                      icon: _testingNewKey
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.add_task_rounded, size: 18),
                      label: Text(_testingNewKey ? 'جاري الفحص...' : 'فحص وإضافة'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      ),
                    ),
                    const SizedBox(width: 6),
                    OutlinedButton(
                      onPressed: _testingNewKey ? null : () => _addNewKey(force: true),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF38BDF8),
                        side: const BorderSide(color: Color(0xFF0284C7)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      ),
                      child: const Text('إضافة مباشرة', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
                if (_canBypassCheck && _newKeyError != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0x2DF59E0B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFF59E0B)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, color: Color(0xFFFBBF24), size: 18),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'تعذر إتمام الفحص التلقائي الحي للمفتاح',
                                style: TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'إذا كان هذا المفتاح صحيحاً ومنسوخاً من Google AI Studio وترغب في اعتماده في النظام دون إعاقة، يمكنك إضافته وتجاوز الفحص الآن ثم الضغط على "حفظ كافة التغييرات":',
                          style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11, height: 1.4),
                        ),
                        const SizedBox(height: 8),
                        ElevatedButton.icon(
                          onPressed: () => _addNewKey(force: true),
                          icon: const Icon(Icons.check_circle_rounded, size: 16),
                          label: const Text('إضافة المفتاح إلى المجمع على أي حال (تجاوز الفحص)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD97706),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Free Setup Guide Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x800284C7)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.lightbulb_rounded, color: Color(0xFFFBBF24), size: 20),
                    SizedBox(width: 8),
                    Text(
                      'كيف تحصل على مفاتيح Gemini مجاناً 100% بدون فيزا؟',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                SizedBox(height: 10),
                Text(
                  '1. افتح موقع Google AI Studio: aistudio.google.com بحساب Gmail عادي.\n'
                  '2. اضغط على "Get API key" ثم "Create API key".\n'
                  '3. انسخ المفتاح وألصقه هنا. ستحصل على 15 طلب مجاني بالدقيقة لكل مفتاح.\n'
                  '💡 نصيحة: يمكنك توليد 3 إلى 5 مفاتيح بحسابات مختلفة وإضافتها معاً لترفع الطاقة الاستيعابية إلى 75 طلب بالدقيقة مجاناً تماماً!',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, height: 1.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          if (_masterError != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0x667F1D1D),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFDC2626)),
              ),
              child: Text(_masterError!, style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
            ),

          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _masterSaving ? null : _saveMasterConfig,
              icon: _masterSaving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.cloud_done_rounded),
              label: Text(
                _masterSaving ? 'جاري حفظ الإعدادات المركزية...' : '💾 اعتماد وحفظ الإعدادات المركزية',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Tab 2: كوتة وحوكمة السناتر (Center Governance)
  // -------------------------------------------------------------------------
  Widget _buildGovernanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Select Institution Dropdown
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('اختيار السنتر / المؤسسة التعليمية', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                const SizedBox(height: 8),
                if (_institutions.isEmpty)
                  const Text('لا توجد مؤسسات مسجلة في النظام بعد', style: TextStyle(color: Color(0xFFFCA5A5)))
                else
                  DropdownButtonFormField<String>(
                    initialValue: _institutions.any((i) => i.institutionId == _selectedInstitutionId)
                        ? _selectedInstitutionId
                        : _institutions.first.institutionId,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                    items: _institutions
                        .map((i) => DropdownMenuItem(
                              value: i.institutionId,
                              child: Text(
                                i.name.isNotEmpty ? '${i.name} (${i.institutionId})' : i.institutionId,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedInstitutionId = val);
                        _loadGovernance();
                      }
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_govLoading)
            const Center(child: Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(color: Color(0xFF38BDF8)),
            ))
          else ...[
            // Center Quota & Feature Governance Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Center AI Enable Toggle
                  SwitchListTile(
                    title: const Text(
                      'تفعيل خدمة الذكاء الاصطناعي لهذا السنتر',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: Text(
                      _aiEnabled ? 'الخدمة مفعلة حالياً ومتاحة للسنتر' : 'الخدمة معطلة بالكامل عن هذا السنتر',
                      style: TextStyle(color: _aiEnabled ? const Color(0xFF4ADE80) : const Color(0xFF94A3B8), fontSize: 12),
                    ),
                    value: _aiEnabled,
                    activeThumbColor: const Color(0xFF38BDF8),
                    onChanged: (v) => setState(() => _aiEnabled = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  const Divider(color: Color(0xFF334155), height: 24),

                  // VIP Subscription Gating Toggle
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _vipRequired ? const Color(0x4D78350F) : const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _vipRequired ? const Color(0xFFF59E0B) : const Color(0xFF334155),
                      ),
                    ),
                    child: SwitchListTile(
                      title: const Row(
                        children: [
                          Icon(Icons.star_rounded, color: Color(0xFFFBBF24), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'اشتراط اشتراك VIP للاستفادة من الذكاء',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      subtitle: const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text(
                          'عند التفعيل، يحصر تطبيق السنتر استخدام المساعد الذكي فقط على الطلاب والمعلمين المشتركين بنظام VIP.',
                          style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
                        ),
                      ),
                      value: _vipRequired,
                      activeThumbColor: const Color(0xFFFBBF24),
                      onChanged: (v) => setState(() => _vipRequired = v),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Total Center Monthly Quota
                  const Text(
                    'الكوتة الشهرية الإجمالية للسنتر (Total Monthly Quota):',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        label: const Text('1,000 طلب'),
                        backgroundColor: _totalLimitController.text == '1000' ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                        labelStyle: TextStyle(color: _totalLimitController.text == '1000' ? Colors.white : const Color(0xFFCBD5E1)),
                        onPressed: () => _applyQuickQuota(1000),
                      ),
                      ActionChip(
                        label: const Text('5,000 طلب'),
                        backgroundColor: _totalLimitController.text == '5000' ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                        labelStyle: TextStyle(color: _totalLimitController.text == '5000' ? Colors.white : const Color(0xFFCBD5E1)),
                        onPressed: () => _applyQuickQuota(5000),
                      ),
                      ActionChip(
                        label: const Text('10,000 طلب'),
                        backgroundColor: _totalLimitController.text == '10000' ? const Color(0xFF0284C7) : const Color(0xFF0F172A),
                        labelStyle: TextStyle(color: _totalLimitController.text == '10000' ? Colors.white : const Color(0xFFCBD5E1)),
                        onPressed: () => _applyQuickQuota(10000),
                      ),
                      ActionChip(
                        label: const Text('غير محدود (50k)'),
                        backgroundColor: _totalLimitController.text == '50000' ? const Color(0xFF059669) : const Color(0xFF0F172A),
                        labelStyle: TextStyle(color: _totalLimitController.text == '50000' ? Colors.white : const Color(0xFFCBD5E1)),
                        onPressed: () => _applyQuickQuota(50000),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _totalLimitController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'إجمالي الحد الشهري للسنتر',
                      labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      suffixIcon: const Icon(Icons.speed_rounded, color: Color(0xFF38BDF8)),
                    ),
                  ),
                  const Divider(color: Color(0xFF334155), height: 24),

                  // Feature Specific Flags & Limits
                  const Text('الخدمات المفعلة وحدودها الشهرية:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 8),

                  SwitchListTile(
                    title: const Text('مساعد الطالب الذكي (AI Tutor)', style: TextStyle(color: Colors.white, fontSize: 13)),
                    value: _tutorEnabled,
                    activeThumbColor: const Color(0xFF38BDF8),
                    onChanged: (v) => setState(() => _tutorEnabled = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (_tutorEnabled)
                    TextField(
                      controller: _tutorLimitController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'حد الطالب الفردي شهرياً (طلبات)',
                        labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  const SizedBox(height: 10),

                  SwitchListTile(
                    title: const Text('مساعد المعلم ومولد الاختبارات', style: TextStyle(color: Colors.white, fontSize: 13)),
                    value: _teacherEnabled,
                    activeThumbColor: const Color(0xFF38BDF8),
                    onChanged: (v) => setState(() => _teacherEnabled = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (_teacherEnabled)
                    TextField(
                      controller: _teacherLimitController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'حد المعلم الفردي شهرياً (طلبات)',
                        labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  const SizedBox(height: 10),

                  SwitchListTile(
                    title: const Text('ميزة بنك الأسئلة وتوليد التمارين', style: TextStyle(color: Colors.white, fontSize: 13)),
                    value: _featureEnabled,
                    activeThumbColor: const Color(0xFF38BDF8),
                    onChanged: (v) => setState(() => _featureEnabled = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (_featureEnabled)
                    TextField(
                      controller: _limitController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'حد بنك الأسئلة للسنتر',
                        labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),

                  const SizedBox(height: 18),
                  if (_govError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_govError!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
                    ),

                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton.icon(
                      onPressed: _govSaving ? null : _saveGovernance,
                      icon: _govSaving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_rounded),
                      label: Text(_govSaving ? 'جاري الحفظ...' : 'حفظ حوكمة السنتر'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Live Usage Log Card
            const Text('📊 سجلات الاستهلاك الفعلي للسنتر', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (_usage.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: const Text('لا توجد سجلات استهلاك مدونة لهذا السنتر بعد.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
              )
            else
              ..._usage.map((u) => Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('${u.month} — ${u.feature}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                              Text(
                                '${((u.usageRatio) * 100).toStringAsFixed(0)}%',
                                style: TextStyle(
                                  color: u.isExhausted ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: u.usageRatio,
                              backgroundColor: const Color(0xFF334155),
                              color: u.isExhausted ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                              minHeight: 6,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'المستخدم: ${u.used} طلب | الكوتة: ${u.limit} | المتبقي: ${u.remaining}${u.isExhausted ? ' (مستنفد)' : ''}',
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  )),
            const SizedBox(height: 30),
          ],
        ],
      ),
    );
  }
}
