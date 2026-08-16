/**
 * Shared search-word hygiene. «أبغا رولكس» must match a «رولكس» auction: the
 * filler words people naturally type are dropped BEFORE the AND-of-ilikes
 * query and before they become chips. If filtering leaves nothing, the
 * original words stand — a query of only filler still searches literally
 * rather than returning everything.
 */

const AR_STOPWORDS = new Set([
  "ابغا", "أبغا", "ابغى", "أبغى", "ابي", "أبي", "ابيه", "بغيت",
  "اريد", "أريد", "ودي", "يا", "ليت", "لو", "عندكم", "فيه", "في",
  "من", "على", "عن", "الى", "إلى", "او", "أو", "و", "ثم", "مع",
  "هل", "وش", "ايش", "شي", "شيء", "حق", "حقت", "عشان",
]);

export function searchWords(q: string): string[] {
  const words = q.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const kept = words.filter((w) => !AR_STOPWORDS.has(w));
  return (kept.length > 0 ? kept : words).slice(0, 6);
}
