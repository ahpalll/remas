import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_branding.dart';

class ParentBrandingService {
  FirebaseFirestore? get _db {
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  Future<AppBranding> fetchAuthenticatedBranding() async {
    final user = _auth?.currentUser;
    if (user == null) {
      return AppBranding.platformDefault();
    }

    try {
      final tokenResult = await user.getIdTokenResult();
      var instId = tokenResult.claims?['institutionId'] as String?;

      final db = _db;
      if (db != null && (instId == null || instId.isEmpty)) {
        // Resolve authorized child's institutionId
        final parentDoc = await db.collection('parents').doc(user.uid).get();
        if (parentDoc.exists && parentDoc.data() != null) {
          final data = parentDoc.data()!;
          instId = data['institutionId'] as String?;
        }
      }

      if (instId == null || instId.isEmpty) {
        return AppBranding.platformDefault();
      }

      if (db == null) {
        return AppBranding.platformDefault();
      }

      final instDoc = await db.collection('institutions').doc(instId).get();
      if (instDoc.exists && instDoc.data() != null) {
        final data = instDoc.data()!;
        if (data.containsKey('branding') && data['branding'] is Map) {
          return AppBranding.fromJson(data, instId: instId);
        }
      }
    } catch (_) {
      return AppBranding.platformDefault();
    }

    return AppBranding.platformDefault();
  }
}
