import 'package:flutter/material.dart';
import '../services/student_auth_service.dart';
import '../models/app_branding.dart';

/// Forced password change screen after first login with initial PIN
class ChangePasswordScreen extends StatefulWidget {
  final AppBranding branding;
  final VoidCallback onPasswordChanged;

  const ChangePasswordScreen({
    super.key,
    required this.branding,
    required this.onPasswordChanged,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _authService = StudentAuthService();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _isLoading = false;
  String _errorMessage = '';
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  Future<void> _handleChangePassword() async {
    final password = _passwordController.text.trim();
    final confirm = _confirmController.text.trim();

    if (password.isEmpty || confirm.isEmpty) {
      setState(() {
        _errorMessage = 'يرجى إدخال كلمة المرور وتأكيدها';
      });
      return;
    }

    if (password != confirm) {
      setState(() {
        _errorMessage = 'كلمتا المرور غير متطابقتين';
      });
      return;
    }

    if (password.length < 6) {
      setState(() {
        _errorMessage = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      });
      return;
    }

    setState(() {
      _errorMessage = '';
      _isLoading = true;
    });

    try {
      // NOTE: we do NOT pre-gate on client-side claims here — claims can lag
      // behind a center reset. The Cloud Function is the authority and returns
      // PASSWORD_ALREADY_CHANGED / INVALID_ACCOUNT_STATE, which we map below.
      await _authService.completeFirstLogin(
        newPassword: password,
        confirmPassword: confirm,
      );

      if (mounted) {
        widget.onPasswordChanged();
      }
    } on StudentAuthException catch (e) {
      setState(() {
        _errorMessage = e.message;
        // Provide more specific guidance for common errors
        if (e.code == 'PASSWORD_ALREADY_CHANGED') {
          _errorMessage = 'تم تغيير كلمة المرور مسبقًا. يرجى تسجيل الدخول بكلمة المرور الحالية.';
        } else if (e.code == 'INVALID_ACCOUNT_STATE') {
          _errorMessage = 'لا يمكن تغيير كلمة المرور في الحالة الحالية للحساب. تواصل مع إدارة السنتر.';
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.branding;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('إنشاء كلمة مرور جديدة'),
          centerTitle: true,
          backgroundColor: b.primaryColor,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 32),
                Icon(
                  Icons.lock_reset,
                  size: 64,
                  color: b.primaryColor,
                ),
                const SizedBox(height: 16),
                Text(
                  'يجب عليك إنشاء كلمة مرور خاصة بك',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: b.primaryColor,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'للأمان، يجب عليك تغيير الرقم السري الابتدائي إلى كلمة مرور خاصة بك قبل استخدام التطبيق.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.grey,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 32),
                if (_errorMessage.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(
                      _errorMessage,
                      style: TextStyle(color: Colors.red.shade900),
                      textAlign: TextAlign.center,
                    ),
                  ),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'كلمة المرور الجديدة',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility : Icons.visibility_off,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _confirmController,
                  obscureText: _obscureConfirm,
                  decoration: InputDecoration(
                    labelText: 'تأكيد كلمة المرور',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirm ? Icons.visibility : Icons.visibility_off,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscureConfirm = !_obscureConfirm;
                        });
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
                  style: TextStyle(
                    color: Colors.grey,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleChangePassword,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: b.primaryColor,
                    foregroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'حفظ كلمة المرور',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
