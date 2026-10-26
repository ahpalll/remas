package com.example.student_app

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Prevent screen capture, screenshots, and screen recording for DRM content protection
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
