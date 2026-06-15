export interface WarrantyBrandProfile {
  id: string;
  brand: string;
  logoUrl?: string;
  logoX?: number;
  logoY?: number;
  logoWidth?: number;
  logoHeight?: number;
}

export const WARRANTY_BRAND_PROFILES_KEY = 'warranty.brandProfiles';

export const DEFAULT_BRAND_LOGOS: Record<string, string> = {
  YAMAHA: '/images/yamaha_black.png',
  ZOOM: '/images/zoom_logo.png',
  OMNITRONIC: '/images/omnitronic_logo.png',
  NEUMANN: '/images/neumann_logo.svg',
  SHURE: '/images/shure_logo.png',
  SENNHEISER: '/images/sennheiser_logo.png',
};

export const normalizeWarrantyBrandProfile = (item: Partial<WarrantyBrandProfile>): WarrantyBrandProfile => ({
  id: String(item.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
  brand: String(item.brand || '').toUpperCase().trim(),
  logoUrl: item.logoUrl ? String(item.logoUrl) : '',
  logoX: Number.isFinite(item.logoX) ? Number(item.logoX) : 10,
  logoY: Number.isFinite(item.logoY) ? Number(item.logoY) : 8,
  logoWidth: Number.isFinite(item.logoWidth) ? Number(item.logoWidth) : 20,
  logoHeight: Number.isFinite(item.logoHeight) ? Number(item.logoHeight) : 10,
});

export const parseBrandProfiles = (raw: string | undefined): WarrantyBrandProfile[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<WarrantyBrandProfile>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.brand === 'string')
      .map(normalizeWarrantyBrandProfile)
      .filter((item) => item.brand);
  } catch {
    return [];
  }
};

export const getBrandProfile = (profiles: WarrantyBrandProfile[], brand: string | undefined) => {
  const upper = String(brand || '').toUpperCase().trim();
  return profiles.find((profile) => profile.brand === upper) ?? null;
};

export const resolveBrandLogo = (profiles: WarrantyBrandProfile[], brand: string | undefined) => {
  const profile = getBrandProfile(profiles, brand);
  if (profile?.logoUrl) return profile.logoUrl;
  return DEFAULT_BRAND_LOGOS[String(brand || '').toUpperCase().trim()] || '';
};
