import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase_options.dart';
import 'services/student_auth_service.dart';
import 'services/branding_service.dart';
import 'services/update_service.dart';
import 'models/app_branding.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/change_password_screen.dart';
import 'screens/update_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    // Falls back if app is already initialized or running in test environment
  }
  runApp(const StudentApp());
}

class StudentApp extends StatefulWidget {
  const StudentApp({super.key});

  @override
  State<StudentApp> createState() => _StudentAppState();
}

class _StudentAppState extends State<StudentApp> {
  final _authService = StudentAuthService();
  final _brandingService = BrandingService();

  AppBranding _currentBranding = AppBranding.platformDefault();
  bool _isLoadingBranding = false;
  bool _mustChangePassword = false;

  @override
  void initState() {
    super.initState();
    _listenToAuthChanges();
    _checkForUpdate();
  }

  Future<void> _checkForUpdate() async {
    try {
      final updateInfo = await StudentUpdateService.checkForUpdate();
      if (updateInfo != null && mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => UpdateScreen(updateInfo: updateInfo),
          ),
        );
      }
    } catch (_) {
      // Fail-closed: connection failure does not block app usage
    }
  }

  void _listenToAuthChanges() {
    _authService.authStateChanges.listen((user) async {
      if (user != null) {
        setState(() {
          _isLoadingBranding = true;
        });

        // Resolve the authoritative status from trusted backend; fall back to claims
        String? status = await _authService.getSelfStatus();
        status ??= (await _authService.getIdTokenClaims())?['status'] as String?;

        if (status == 'INACTIVE' || status == 'ARCHIVED') {
          // Account is explicitly deactivated - sign out.
          await _authService.signOut();
          if (mounted) {
            setState(() {
              _currentBranding = AppBranding.platformDefault();
              _isLoadingBranding = false;
              _mustChangePassword = false;
            });
          }
          return;
        }

        bool mustChangePassword = status == 'MUST_CHANGE_PASSWORD' || _mustChangePassword;
        if (!mustChangePassword) {
          mustChangePassword = await _authService.checkMustChangePassword(user.uid);
        }

        final branding = await _brandingService.fetchAuthenticatedBranding();
        if (mounted) {
          setState(() {
            _currentBranding = branding;
            _isLoadingBranding = false;
            _mustChangePassword = mustChangePassword || _mustChangePassword;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _currentBranding = AppBranding.platformDefault();
            _isLoadingBranding = false;
            _mustChangePassword = false;
          });
        }
      }
    });
  }

  void _handleLoginSuccess(bool mustChangePassword) {
    setState(() {
      _mustChangePassword = mustChangePassword;
    });
  }

  void _handlePasswordChanged() {
    setState(() {
      _mustChangePassword = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: _currentBranding.centerName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _currentBranding.primaryColor,
          primary: _currentBranding.primaryColor,
          secondary: _currentBranding.secondaryColor,
        ),
        scaffoldBackgroundColor: _currentBranding.backgroundColor,
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: StreamBuilder<User?>(
        stream: _authService.authStateChanges,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting || _isLoadingBranding) {
            return Scaffold(
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    Text(
                      _currentBranding.centerName,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: _currentBranding.primaryColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _currentBranding.welcomeMessage,
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            );
          }
          if (snapshot.hasData && snapshot.data != null) {
            // User is signed in - check if password change is required
            if (_mustChangePassword) {
              return ChangePasswordScreen(
                branding: _currentBranding,
                onPasswordChanged: _handlePasswordChanged,
              );
            }
            return HomeScreen(branding: _currentBranding);
          }
          return LoginScreen(
            branding: _currentBranding,
            onLoginSuccess: _handleLoginSuccess,
          );
        },
      ),
    );
  }
}
