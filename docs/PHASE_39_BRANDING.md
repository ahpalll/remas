# Phase 39 — REMAS EDU White-Label Branding System Architecture

**Platform Identity**: `REMAS EDU` (`رِماس للتقنية التعليمية`)  
**Tagline**: `إدارة أذكى.. تعليم أفضل` / `SMARTER MANAGEMENT .. A BRIGHTER EDUCATION`  
**Monorepo Version**: `1.0.0-release.39`  

---

## 1. Executive Summary

Phase 39 establishes the official REMAS EDU Platform Brand Identity and delivers a server-authoritative, dynamic multi-tenant White-Label Theme Engine across all application clients (Windows Center Desktop, Student Android App, Dedicated Teacher App, Parent App & Web Portal, Admin Web).

All institutions run the same unified software binaries (single APK, single EXE, single Web application bundle). Dynamic branding is resolved at runtime based on the authenticated user's `institutionId` and enforced through Firestore Security Rules.

---

## 2. Platform Brand vs. Institution Brand

```
┌─────────────────────────────────────────────────────────┐
│              REMAS EDU Platform Identity                 │
│         (Immutable Name, Arabic Title & Tagline)        │
└────────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│ Center A (الرائدة)    │         │ Center B (المنارة)    │
│ • Center Name         │         │ • Center Name         │
│ • Custom Colors       │         │ • Custom Colors       │
│ • Custom Logo (R2)    │         │ • Custom Logo (R2)    │
│ • Login Title & Msg   │         │ • Login Title & Msg   │
└───────────────────────┘         └───────────────────────┘
```

---

## 3. Brand Assets Status

> [!WARNING]
> **BLOCKED — OFFICIAL LOGO ASSET FILE REQUIRED**
> 
> The official visual logo asset files (`remas_logo_primary`, `remas_logo_horizontal`, `remas_logo_arabic`, `remas_icon`, `remas_splash_logo`, `remas_app_icon`) are not currently present in the repository file tree.
> As required by specifications, no substitute CSS approximation or alternate logo has been created. The theme engine operates seamlessly with text/token fallbacks until official image files are supplied.

---

## 4. Brand Tokens & Color Palette

- **Primary**: Deep Navy Blue (`#0F172A`)
- **Secondary**: Bright / Cyan Blue (`#0284C7`)
- **Accent**: Gold (`#D97706`)
- **Supporting**: Light Blue (`#E0F2FE`)
- **Neutral**: White (`#FFFFFF`)
- **Dark Background**: Deep Blue / Navy (`#0A192F`)

---

## 5. Security & Input Sanitization

1. **Color Validation**: Enforces strict `#RRGGBB` hex color format on both client and server, preventing CSS injection, HTML, or JavaScript payloads.
2. **Asset Validation**: Validates file extension (`.png`, `.jpg`, `.jpeg`, `.webp`), MIME type (`image/png`, `image/jpeg`, `image/webp`), and file size (`<= 5 MB`). Rejects executable files, HTML, JS, and unsanitized SVG.
3. **Tenant Isolation**: Firestore Security Rules and server-side checks verify `request.auth.token.institutionId == institutionId`. Center Owners cannot view or modify another center's branding.
4. **SuperAdmin Privileges**: Only SuperAdmin can reset an institution's branding to REMAS default tokens or modify global platform taglines.
