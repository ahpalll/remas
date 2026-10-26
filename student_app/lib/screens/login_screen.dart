import 'package:flutter/material.dart';
import '../services/student_auth_service.dart';
import '../models/app_branding.dart';

/// Student Login Screen - Phone + Password
class LoginScreen extends StatefulWidget {
  final AppBranding branding;
  final void Function(bool mustChangePassword) onLoginSuccess;

  const LoginScreen({
    super.key,
    required this.branding,
    required this.onLoginSuccess,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _authService = StudentAuthService();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  String _errorMessage = '';
  bool _obscurePassword = true;

  Future<void> _handleLogin() async {
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    if (phone.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'يرجى إدخال رقم الهاتف وكلمة المرور';
      });
      return;
    }

    setState(() {
      _errorMessage = '';
      _isLoading = true;
    });

    try {
      final result = await _authService.loginWithPhoneAndPassword(
        phone: phone,
        password: password,
      );

      if (mounted) {
        widget.onLoginSuccess(result.mustChangePassword);
      }
    } on StudentAuthException catch (e) {
      setState(() {
        _errorMessage = e.message;
        // For inactive accounts, show additional guidance
        if (e.code == 'ACCOUNT_INACTIVE') {
          _errorMessage = 'هذا الحساب غير نشط. يرجى التواصل مع إدارة السنتر لتفعيل حسابك.';
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
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.branding;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(b.loginTitle),
          centerTitle: true,
          backgroundColor: b.primaryColor,
          foregroundColor: Colors.white,
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 32),
                Center(
                  child: Image.asset(
                    'assets/logo.png',
                    height: 90,
                    errorBuilder: (_, __, ___) {
                      if (b.logoUrl != null && b.logoUrl!.isNotEmpty) {
                        return Image.network(
                          b.logoUrl!,
                          height: 90,
                          errorBuilder: (_, __, ___) => _buildDefaultLogo(b),
                        );
                      }
                      return _buildDefaultLogo(b);
                    },
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  b.centerName,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: b.primaryColor),
                ),
                const SizedBox(height: 8),
                const Text(
                  'دخول الطالب برقم الموبايل وكلمة المرور',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 14),
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
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'رقم موبايل الطالب (مثال: 01011112222)',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.phone_android),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'كلمة المرور',
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
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: b.primaryColor,
                    foregroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('تسجيل الدخول', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 16),
                const Text(
                  'إذا كنت تواجه مشكلة في تسجيل الدخول، تواصل مع إدارة السنتر.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDefaultLogo(AppBranding b) {
    return Container(
      width: 84,
      height: 84,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [b.primaryColor, b.secondaryColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: b.primaryColor.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(Icons.school, size: 44, color: Colors.white),
    );
  }
}
