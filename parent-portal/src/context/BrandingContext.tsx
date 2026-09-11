import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export interface PortalBranding {
  institutionId: string;
  centerName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  loginTitle: string;
  welcomeMessage: string;
  isPlatformDefault: boolean;
}

export const PLATFORM_DEFAULT_BRANDING: PortalBranding = {
  institutionId: 'platform',
  centerName: 'رِماس للتقنية التعليمية',
  primaryColor: '#0F172A',
  secondaryColor: '#0284C7',
  accentColor: '#D97706',
  backgroundColor: '#FFFFFF',
  logoUrl: null,
  loginTitle: 'بوابة أولياء الأمور — منصة رِماس EDU',
  welcomeMessage: 'إدارة أذكى.. تعليم أفضل',
  isPlatformDefault: true,
};

interface BrandingContextType {
  branding: PortalBranding;
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: PLATFORM_DEFAULT_BRANDING,
  loading: false,
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, institutionId } = useAuth();
  const [branding, setBranding] = useState<PortalBranding>(PLATFORM_DEFAULT_BRANDING);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadBranding() {
      if (!currentUser || !institutionId) {
        setBranding(PLATFORM_DEFAULT_BRANDING);
        return;
      }

      setLoading(true);
      try {
        const instRef = doc(db, 'institutions', institutionId);
        const snap = await getDoc(instRef);

        if (snap.exists()) {
          const data = snap.data();
          const raw = (data?.branding && typeof data.branding === 'object') ? data.branding : data;

          setBranding({
            institutionId,
            centerName: raw.centerName?.trim() || data.name?.trim() || PLATFORM_DEFAULT_BRANDING.centerName,
            primaryColor: raw.primaryColor || PLATFORM_DEFAULT_BRANDING.primaryColor,
            secondaryColor: raw.secondaryColor || PLATFORM_DEFAULT_BRANDING.secondaryColor,
            accentColor: raw.accentColor || PLATFORM_DEFAULT_BRANDING.accentColor,
            backgroundColor: raw.backgroundColor || PLATFORM_DEFAULT_BRANDING.backgroundColor,
            logoUrl: raw.logoUrl || null,
            loginTitle: raw.loginTitle || `بوابة أولياء الأمور — ${raw.centerName || 'رِماس EDU'}`,
            welcomeMessage: raw.welcomeMessage || PLATFORM_DEFAULT_BRANDING.welcomeMessage,
            isPlatformDefault: false,
          });
        } else {
          setBranding(PLATFORM_DEFAULT_BRANDING);
        }
      } catch (err) {
        setBranding(PLATFORM_DEFAULT_BRANDING);
      } finally {
        setLoading(false);
      }
    }

    loadBranding();
  }, [currentUser, institutionId]);

  return (
    <BrandingContext.Provider value={{ branding, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextType {
  return useContext(BrandingContext);
}
