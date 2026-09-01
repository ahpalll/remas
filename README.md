# Educational Center Management SaaS Platform

## Master Prompt Specification

This project implements an integrated SaaS platform for managing educational centers (senaturs). The platform consists of:

- **Admin Web** (React + TypeScript): Full management dashboard for institution owners and super admins
- **Student App** (Flutter): Student-facing application for learning content, attendance, grades, and subscriptions
- **Parent Portal** (React): Parent dashboard to monitor children's progress

## Technology Stack

- **Database**: Firebase Cloud Firestore
- **Authentication**: Firebase Authentication
- **File Storage**: Cloudflare R2 (with Cloudflare Workers for secure access)
- **Notifications**: Firebase Cloud Messaging
- **Student App**: Flutter + Dart
- **Web Applications**: React + TypeScript
- **AI**: RAG-based educational assistant with tenant isolation

## Prerequisites

See `docs/ENVIRONMENT_AUDIT.md` for required tools and versions.

## Project Structure

```
project-root/
├── admin-web/          # React + TypeScript admin dashboard
├── student-app/        # Flutter student application
├── parent-portal/      # React parent portal
├── cloudflare/         # Cloudflare Workers configuration
│   └── video-access-worker/  # Secure video access worker
├── firebase/           # Firebase configuration
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── firebase.json
│   └── functions/
├── docs/               # Documentation
├── scripts/            # Build and deployment scripts
├── .env.example        # Environment variables template
├── .gitignore
└── MASTER PROMPT.md    # Master requirements specification
```

## Development

1. Install dependencies for each project
2. Set up environment variables from `.env.example`
3. Run `firebase emulators:start` for local development
4. Run Flutter app on emulator/device

## License

Proprietary - all rights reserved