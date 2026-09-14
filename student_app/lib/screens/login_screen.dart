import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../models/app_branding.dart';

enum LoginStep { enterPhone, enterOtp, selectInstitution }

class LoginScreen extends StatefulWidget {
  final AppBranding branding;

  const LoginScreen({super.key, required this.branding});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _authService = AuthService();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();

  LoginStep _step = LoginStep.enterPhone;
  String _errorMessage = '';
  bool _isLoading = false;
  String? _verificationId;

  String _normalizePhone(String input) {
    String cleaned = input.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleaned.startsWith('+20')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('01')) {
      cleaned = '2$cleaned';
    }
    if (cleaned.startsWith('201') && cleaned.length == 12) {
      return '+$cleaned';
    }
    return input.trim();
  }

  Future<void> _handleSendOtp() async {
    final rawPhone = _phoneController.text.trim();
    if (rawPhone.isEmpty) {
      setState(() {
        _errorMessage = 'يرجى إدخال رقم هاتف الطالب';
      });
      return;
    }

    final formattedPhone = _normalizePhone(rawPhone);
    if (!RegExp(r'^\+201[0125]\d{8}$').hasMatch(formattedPhone)) {
      setState(() {
        _errorMessage = 'رقم الهاتف غير صحيح. يرجى كتابة رقم موبايل مصري صحيح (مثال: 01011112222)';
      });
      return;
    }

    setState(() {
      _errorMessage = '';
      _isLoading = true;
    });

    try {
      await _authService.verifyPhoneNumber(
        phoneNumber: formattedPhone,
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Auto verification completed
          try {
            await FirebaseAuth.instance.signInWithCredential(credential);
          } catch (_) {}
        },
        verificationFailed: (FirebaseAuthException e) {
          setState(() {
            _isLoading = false;
            _errorMessage = e.message ?? 'فشل إرسال رمز التحقق. يرجى التثبت من اتصال الشبكة ورقم الهاتف.';
          });
        },
        codeSent: (String verificationId, int? resendToken) {
          setState(() {
            _isLoading = false;
            _verificationId = verificationId;
            _step = LoginStep.enterOtp;
          });
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          _verificationId = verificationId;
        },
      );
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'حدث خطأ غير متوقع أثناء إرسال رمز التحقق.';
      });
    }
  }

  Future<void> _handleVerifyOtp() async {
    final smsCode = _otpController.text.trim();
    if (smsCode.length != 6) {
      setState(() {
        _errorMessage = 'رمز التحقق يجب أن يتكون من 6 أرقام';
      });
      return;
    }

    if (_verificationId == null) {
      setState(() {
        _errorMessage = 'انتهت صلاحية الجلسة. يرجى إعادة طلب رمز التحقق.';
      });
      return;
    }

    setState(() {
      _errorMessage = '';
      _isLoading = true;
    });

    try {
      final userCred = await _authService.signInWithPhoneCredential(_verificationId!, smsCode);
      if (userCred?.user == null) {
        throw FirebaseAuthException(code: 'invalid-credential', message: 'رمز التحقق غير صحيح');
      }
    } on FirebaseAuthException catch (e) {
      setState(() {
        if (e.code == 'invalid-verification-code' || e.code == 'invalid-credential') {
          _errorMessage = 'رمز التحقق (OTP) غير صحيح. يرجى إعادة المحاولة.';
        } else if (e.code == 'session-expired') {
          _errorMessage = 'انتهت صلاحية رمز التحقق. يرجى إعادة طلب كود جديد.';
        } else {
          _errorMessage = e.message ?? 'فشل التحقق من الكود.';
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'حدث خطأ أثناء التوثيق.';
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
    _otpController.dispose();
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
                if (b.logoUrl != null && b.logoUrl!.isNotEmpty)
                  Image.network(b.logoUrl!, height: 80, errorBuilder: (_, __, ___) => Icon(Icons.school, size: 64, color: b.primaryColor))
                else
                  Icon(Icons.school, size: 64, color: b.primaryColor),
                const SizedBox(height: 16),
                Text(
                  b.centerName,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: b.primaryColor),
                ),
                const SizedBox(height: 8),
                Text(
                  _step == LoginStep.enterPhone ? 'دخول الطالب برقم الموبايل + رمز التحقق (OTP)' : 'أدخل رمز التحقق (OTP) المرسل لهاتفك',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey, fontSize: 14),
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

                if (_step == LoginStep.enterPhone) ...[
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'رقم موبايل الطالب (مثال: 01011112222)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.phone_android),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleSendOtp,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: b.primaryColor,
                      foregroundColor: Colors.white,
                    ),
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('إرسال رمز التحقق (SMS)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ] else if (_step == LoginStep.enterOtp) ...[
                  TextField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(
                      labelText: 'رمز التحقق (6 أرقام)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.security),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleVerifyOtp,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: b.primaryColor,
                      foregroundColor: Colors.white,
                    ),
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('تأكيد الدخول', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _isLoading ? null : () => setState(() { _step = LoginStep.enterPhone; }),
                    child: const Text('تعديل رقم الهاتف'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
