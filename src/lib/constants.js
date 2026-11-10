// ISO 639-1 codes -> display names. Used for movie original language and subtitle language.
export const LANGS = {
  si: { en: 'Sinhala', si: 'සිංහල' },
  ta: { en: 'Tamil', si: 'දෙමළ' },
  te: { en: 'Telugu', si: 'තෙලිඟු' },
  en: { en: 'English', si: 'ඉංග්‍රීසි' },
  hi: { en: 'Hindi', si: 'හින්දි' },
  ml: { en: 'Malayalam', si: 'මලයාලම්' },
  kn: { en: 'Kannada', si: 'කන්නඩ' },
  bn: { en: 'Bengali', si: 'බෙංගාලි' },
  mr: { en: 'Marathi', si: 'මරාති' },
  pa: { en: 'Punjabi', si: 'පන්ජාබි' },
  ur: { en: 'Urdu', si: 'උර්දු' },
  ko: { en: 'Korean', si: 'කොරියානු' },
  ja: { en: 'Japanese', si: 'ජපන්' },
  zh: { en: 'Chinese', si: 'චීන' },
  cn: { en: 'Cantonese', si: 'කැන්ටනීස්' },
  th: { en: 'Thai', si: 'තායි' },
  id: { en: 'Indonesian', si: 'ඉන්දුනීසියානු' },
  tr: { en: 'Turkish', si: 'තුර්කි' },
  fr: { en: 'French', si: 'ප්‍රංශ' },
  es: { en: 'Spanish', si: 'ස්පාඤ්ඤ' },
  de: { en: 'German', si: 'ජර්මන්' },
  it: { en: 'Italian', si: 'ඉතාලි' },
  ru: { en: 'Russian', si: 'රුසියානු' },
  pt: { en: 'Portuguese', si: 'පෘතුගීසි' },
  ar: { en: 'Arabic', si: 'අරාබි' },
  fa: { en: 'Persian', si: 'පර්සියානු' },
}

export const langName = (code, lang = 'si') => LANGS[code]?.[lang] || (code ? code.toUpperCase() : '—')

export const DEFAULT_CATEGORIES = [
  { code: 'ta', en: 'Tamil', si: 'දෙමළ' },
  { code: 'te', en: 'Telugu', si: 'තෙලිඟු' },
  { code: 'en', en: 'English', si: 'ඉංග්‍රීසි' },
  { code: 'hi', en: 'Hindi', si: 'හින්දි' },
]

// TMDB genre names (stored in English) -> Sinhala labels for display.
export const GENRES_SI = {
  Action: 'ක්‍රියාදාම',
  Adventure: 'වික්‍රමාන්විත',
  Animation: 'සජීවීකරණ',
  Comedy: 'හාස්‍ය',
  Crime: 'අපරාධ',
  Documentary: 'වාර්තා',
  Drama: 'නාට්‍යමය',
  Family: 'පවුලේ',
  Fantasy: 'මනඃකල්පිත',
  History: 'ඓතිහාසික',
  Horror: 'භීෂණ',
  Music: 'සංගීත',
  Mystery: 'අභිරහස්',
  Romance: 'ආදර',
  'Science Fiction': 'විද්‍යා ප්‍රබන්ධ',
  'TV Movie': 'රූපවාහිනී චිත්‍රපට',
  Thriller: 'ත්‍රාසජනක',
  War: 'යුද',
  Western: 'වෙස්ටර්න්',
}
export const genreName = (g) => GENRES_SI[g] || g

export const SORTS = [
  { id: 'latest', si: 'නවතම උපසිරැසි', en: 'Latest subtitles' },
  { id: 'popular', si: 'ජනප්‍රිය', en: 'Popular' },
  { id: 'recent', si: 'මෑතකදී එක් කළ', en: 'Recently added' },
  { id: 'rating', si: 'ඉහළ ශ්‍රේණිගත', en: 'Top rated' },
  { id: 'year', si: 'නවතම වසර', en: 'Newest year' },
]

export const FORMATS = ['srt', 'vtt', 'ass', 'zip']

// Rights status of a subtitle file. Only the first four can ever be published
// (this is also enforced by a CHECK constraint in the database).
export const PERMISSIONS = {
  own_work: { label: 'Own work', hint: 'I translated / created this subtitle myself.', publishable: true },
  permission_granted: { label: 'Permission granted', hint: 'The translator / rights holder gave me permission to publish it.', publishable: true },
  licensed: { label: 'Licensed', hint: 'Released under a licence that allows redistribution (e.g. Creative Commons).', publishable: true },
  public_domain: { label: 'Public domain', hint: 'The film and this text are in the public domain.', publishable: true },
  pending_review: { label: 'Pending review', hint: 'Rights not confirmed yet — cannot be published.', publishable: false },
  disputed: { label: 'Disputed', hint: 'A takedown / complaint is open — cannot be published.', publishable: false },
}

export const SOURCE_TYPES = {
  own_transcript: { label: 'My own transcript / translation', permission: 'own_work' },
  own_recording: { label: 'Audio/video I own or produced', permission: 'own_work' },
  permission_granted: { label: 'Written permission from the rights holder', permission: 'permission_granted' },
  licensed: { label: 'Openly licensed source (e.g. Creative Commons)', permission: 'licensed' },
  public_domain: { label: 'Public-domain work', permission: 'public_domain' },
}
