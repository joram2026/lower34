export interface TimezoneInfo {
  timeZone: string;
  code: string;
  flag: string;
  label: string;
}

export const COUNTRY_TIMEZONE_MAP: Record<string, TimezoneInfo> = {
  'kenya': { timeZone: 'Africa/Nairobi', code: 'EAT', flag: '🇰🇪', label: 'Kenya' },
  'ke': { timeZone: 'Africa/Nairobi', code: 'EAT', flag: '🇰🇪', label: 'Kenya' },
  'nigeria': { timeZone: 'Africa/Lagos', code: 'WAT', flag: '🇳🇬', label: 'Nigeria' },
  'ng': { timeZone: 'Africa/Lagos', code: 'WAT', flag: '🇳🇬', label: 'Nigeria' },
  'ghana': { timeZone: 'Africa/Accra', code: 'GMT', flag: '🇬🇭', label: 'Ghana' },
  'gh': { timeZone: 'Africa/Accra', code: 'GMT', flag: '🇬🇭', label: 'Ghana' },
  'south africa': { timeZone: 'Africa/Johannesburg', code: 'SAST', flag: '🇿🇦', label: 'South Africa' },
  'za': { timeZone: 'Africa/Johannesburg', code: 'SAST', flag: '🇿🇦', label: 'South Africa' },
  'uganda': { timeZone: 'Africa/Kampala', code: 'EAT', flag: '🇺🇬', label: 'Uganda' },
  'ug': { timeZone: 'Africa/Kampala', code: 'EAT', flag: '🇺🇬', label: 'Uganda' },
  'tanzania': { timeZone: 'Africa/Dar_es_Salaam', code: 'EAT', flag: '🇹🇿', label: 'Tanzania' },
  'tz': { timeZone: 'Africa/Dar_es_Salaam', code: 'EAT', flag: '🇹🇿', label: 'Tanzania' },
  'rwanda': { timeZone: 'Africa/Kigali', code: 'CAT', flag: '🇷🇼', label: 'Rwanda' },
  'rw': { timeZone: 'Africa/Kigali', code: 'CAT', flag: '🇷🇼', label: 'Rwanda' },
  'ethiopia': { timeZone: 'Africa/Addis_Ababa', code: 'EAT', flag: '🇪🇹', label: 'Ethiopia' },
  'et': { timeZone: 'Africa/Addis_Ababa', code: 'EAT', flag: '🇪🇹', label: 'Ethiopia' },
  'egypt': { timeZone: 'Africa/Cairo', code: 'EET', flag: '🇪🇬', label: 'Egypt' },
  'eg': { timeZone: 'Africa/Cairo', code: 'EET', flag: '🇪🇬', label: 'Egypt' },
  'united kingdom': { timeZone: 'Europe/London', code: 'UK', flag: '🇬🇧', label: 'UK' },
  'uk': { timeZone: 'Europe/London', code: 'UK', flag: '🇬🇧', label: 'UK' },
  'gb': { timeZone: 'Europe/London', code: 'UK', flag: '🇬🇧', label: 'UK' },
  'united states': { timeZone: 'America/New_York', code: 'EST', flag: '🇺🇸', label: 'USA' },
  'us': { timeZone: 'America/New_York', code: 'EST', flag: '🇺🇸', label: 'USA' },
  'usa': { timeZone: 'America/New_York', code: 'EST', flag: '🇺🇸', label: 'USA' },
  'canada': { timeZone: 'America/Toronto', code: 'EST', flag: '🇨🇦', label: 'Canada' },
  'ca': { timeZone: 'America/Toronto', code: 'EST', flag: '🇨🇦', label: 'Canada' },
  'united arab emirates': { timeZone: 'Asia/Dubai', code: 'GST', flag: '🇦🇪', label: 'UAE' },
  'uae': { timeZone: 'Asia/Dubai', code: 'GST', flag: '🇦🇪', label: 'UAE' },
  'ae': { timeZone: 'Asia/Dubai', code: 'GST', flag: '🇦🇪', label: 'UAE' },
  'india': { timeZone: 'Asia/Kolkata', code: 'IST', flag: '🇮🇳', label: 'India' },
  'in': { timeZone: 'Asia/Kolkata', code: 'IST', flag: '🇮🇳', label: 'India' },
  'germany': { timeZone: 'Europe/Berlin', code: 'CET', flag: '🇩🇪', label: 'Germany' },
  'de': { timeZone: 'Europe/Berlin', code: 'CET', flag: '🇩🇪', label: 'Germany' },
  'france': { timeZone: 'Europe/Paris', code: 'CET', flag: '🇫🇷', label: 'France' },
  'fr': { timeZone: 'Europe/Paris', code: 'CET', flag: '🇫🇷', label: 'France' },
  'australia': { timeZone: 'Australia/Sydney', code: 'AEST', flag: '🇦🇺', label: 'Australia' },
  'au': { timeZone: 'Australia/Sydney', code: 'AEST', flag: '🇦🇺', label: 'Australia' },
};

export const getUserTimezoneInfo = (userCountry?: string): TimezoneInfo => {
  const normalized = (userCountry || '').trim().toLowerCase();
  if (normalized && COUNTRY_TIMEZONE_MAP[normalized]) {
    return COUNTRY_TIMEZONE_MAP[normalized];
  }

  // Detect system timezone as fallback
  try {
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      timeZone: sysTz,
      code: 'LOCAL',
      flag: '🌐',
      label: userCountry || 'Local Time',
    };
  } catch {
    return {
      timeZone: 'Africa/Nairobi',
      code: 'EAT',
      flag: '🇰🇪',
      label: 'Kenya',
    };
  }
};

export interface FormattedSignalTime {
  eatTime: string;          // e.g. "13:00 EAT"
  eatFormatted12: string;   // e.g. "1:00 PM EAT"
  localTimeStr: string;     // e.g. "11:00 AM"
  localTimeFull: string;    // e.g. "11:00 AM (🇳🇬 Nigeria WAT)"
  isDifferentCountry: boolean;
  userCountryInfo: TimezoneInfo;
}

export const formatSignalTimeForCountry = (
  sigTime: string,
  userCountry?: string
): FormattedSignalTime => {
  const countryInfo = getUserTimezoneInfo(userCountry);

  if (!sigTime) {
    return {
      eatTime: '12:00 EAT',
      eatFormatted12: '12:00 PM EAT',
      localTimeStr: '12:00 PM',
      localTimeFull: '12:00 PM EAT',
      isDifferentCountry: false,
      userCountryInfo: countryInfo,
    };
  }

  const parts = sigTime.split(':');
  const sigHour = parseInt(parts[0] || '12', 10);
  const sigMin = parseInt(parts[1] || '0', 10);

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Find today's date in Kenya (EAT / UTC+3)
  const now = new Date();
  const kenyaDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(now).split('/').map(Number);

  const m = pad(kenyaDateParts[0]);
  const d = pad(kenyaDateParts[1]);
  const y = kenyaDateParts[2];

  // ISO string representing Kenya start time
  const isoKenya = `${y}-${m}-${d}T${pad(sigHour)}:${pad(sigMin)}:00+03:00`;
  const signalDate = new Date(isoKenya);

  // Format Kenya 12-hour
  const eatFormatted12 = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(signalDate) + ' EAT';

  // Format in user local timezone
  let localTimeStr = '';
  try {
    localTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: countryInfo.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(signalDate);
  } catch {
    localTimeStr = eatFormatted12;
  }

  const isKenyaTz =
    countryInfo.timeZone === 'Africa/Nairobi' ||
    countryInfo.label.toLowerCase() === 'kenya';

  const localTimeFull = isKenyaTz
    ? `${sigTime} EAT (${eatFormatted12} 🇰🇪)`
    : `${localTimeStr} (${countryInfo.flag} ${countryInfo.label} ${countryInfo.code})`;

  return {
    eatTime: `${sigTime} EAT`,
    eatFormatted12,
    localTimeStr,
    localTimeFull,
    isDifferentCountry: !isKenyaTz,
    userCountryInfo: countryInfo,
  };
};
