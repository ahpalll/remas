// File: superadmin_app/lib/firebase_options.dart
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
/// Target Project: educenter-saas-860c5
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
    appId: '1:522787600693:web:2416c6c770fb98785f747c',
    messagingSenderId: '522787600693',
    projectId: 'educenter-saas-860c5',
    authDomain: 'educenter-saas-860c5.firebaseapp.com',
    storageBucket: 'educenter-saas-860c5.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
    appId: '1:522787600693:android:2416c6c770fb98785f747c',
    messagingSenderId: '522787600693',
    projectId: 'educenter-saas-860c5',
    storageBucket: 'educenter-saas-860c5.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
    appId: '1:522787600693:ios:2416c6c770fb98785f747c',
    messagingSenderId: '522787600693',
    projectId: 'educenter-saas-860c5',
    storageBucket: 'educenter-saas-860c5.firebasestorage.app',
    iosBundleId: 'com.example.superadminApp',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
    appId: '1:522787600693:ios:2416c6c770fb98785f747c',
    messagingSenderId: '522787600693',
    projectId: 'educenter-saas-860c5',
    storageBucket: 'educenter-saas-860c5.firebasestorage.app',
    iosBundleId: 'com.example.superadminApp',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyBnsc7JvEKUNyKDxfo0iQP0pJrw41VnZfY',
    appId: '1:522787600693:web:2416c6c770fb98785f747c',
    messagingSenderId: '522787600693',
    projectId: 'educenter-saas-860c5',
    authDomain: 'educenter-saas-860c5.firebaseapp.com',
    storageBucket: 'educenter-saas-860c5.firebasestorage.app',
  );
}
