// iOS preferences are authoritative: Hermes Intl can retain its bundled en-US default.
// Keep preferred UI language separate from the region used for measurement units.
export function initialDisplaySettings(nativePreferences: unknown, intlLocale: string): {language: 'de' | 'en'; unitSystem: 'metric' | 'imperial'} {
 const locale = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().split('@')[0].replace(/_/g, '-');
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(normalized) ? normalized : null;
 };
 const preferences = nativePreferences && typeof nativePreferences === 'object' && !Array.isArray(nativePreferences) ? nativePreferences as Record<string, unknown> : {};
 const fallback = locale(intlLocale) ?? 'en-GB';
 const regional = locale(preferences.AppleLocale) ?? fallback;
 const preferred = Array.isArray(preferences.AppleLanguages) ? preferences.AppleLanguages.map(locale).find((value): value is string => value !== null) : undefined;
 const language = (preferred ?? regional).split('-')[0].toLowerCase() === 'de' ? 'de' : 'en';
 return {language, unitSystem: regional.split('-').some((part) => part.toUpperCase() === 'US') ? 'imperial' : 'metric'};
}
