import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'services/auth_service.dart';
import 'services/branding_service.dart';
import 'models/app_branding.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
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
  final _authService = AuthService();
  final _brandingService = BrandingService();

  AppBranding _currentBranding = AppBranding.platformDefault();
  bool _isLoadingBranding = false;

  @override
  void initState() {
    super.initState();
    _listenToAuthChanges();
  }

  void _listenToAuthChanges() {
    _authService.authStateChanges.listen((user) async {
      if (user != null) {
        setState(() {
          _isLoadingBranding = true;
        });
        final branding = await _brandingService.fetchAuthenticatedBranding();
        if (mounted) {
          setState(() {
            _currentBranding = branding;
            _isLoadingBranding = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _currentBranding = AppBranding.platformDefault();
            _isLoadingBranding = false;
          });
        }
      }
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
            return HomeScreen(branding: _currentBranding);
          }
          return LoginScreen(branding: _currentBranding);
        },
      ),
    );
  }
}
