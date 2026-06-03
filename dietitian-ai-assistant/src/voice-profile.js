const emojiPattern = /[\u{1F300}-\u{1FAFF}]/gu;

const informalTerms = [
  "canım",
  "tatlım",
  "harika",
  "süper",
  "devam",
  "güzel gidiyorsun",
  "great job",
  "awesome",
  "love it",
  "super",
  "toll",
  "klasse",
  "genial",
  "super",
  "bravo",
  "parfait",
  "genial",
  "incrivel",
  "skvele",
  "skvely",
];

const formalTerms = [
  "sayın",
  "rica ederim",
  "uygundur",
  "öneririm",
  "kontrol edelim",
  "dear sir",
  "dear madam",
  "kind regards",
  "please note",
  "sehr geehrte",
  "mit freundlichen",
  "bitte beachten",
  "madame",
  "monsieur",
  "cordialement",
  "veuillez",
  "estimado",
  "atentamente",
  "prezado",
  "vazeny",
  "prosim",
];

export function buildDietitianVoiceProfile(samples) {
  const cleanSamples = samples.map((sample) => sample.trim()).filter(Boolean);
  if (cleanSamples.length === 0) {
    return defaultVoiceProfile();
  }

  const totalChars = cleanSamples.reduce((sum, sample) => sum + sample.length, 0);
  const joined = cleanSamples.join(" ").toLowerCase();
  const emojiCount = (joined.match(emojiPattern) || []).length;
  const informalScore = scoreTerms(joined, informalTerms);
  const formalScore = scoreTerms(joined, formalTerms);

  return {
    averageMessageChars: Math.round(totalChars / cleanSamples.length),
    formality: formalScore > informalScore ? "formal" : informalScore > formalScore ? "informal" : "balanced",
    emojiPolicy: emojiCount === 0 ? "none" : emojiCount / cleanSamples.length > 0.5 ? "regular" : "limited",
    commonGreetings: extractStarts(cleanSamples),
    commonClosings: extractClosings(cleanSamples),
    styleNotes: buildStyleNotes({ informalScore, formalScore, emojiCount, sampleCount: cleanSamples.length }),
  };
}

export function defaultVoiceProfile() {
  return {
    averageMessageChars: 140,
    formality: "balanced",
    emojiPolicy: "limited",
    commonGreetings: [],
    commonClosings: [],
    styleNotes: "Use concise, practical Turkish. Stay warm but clinically conservative.",
  };
}

function scoreTerms(text, terms) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function extractStarts(samples) {
  return Array.from(
    new Set(
      samples
        .map((sample) => sample.split(/[,.!\n]/)[0]?.trim())
        .filter((part) => part && part.length <= 24)
        .slice(0, 5),
    ),
  );
}

function extractClosings(samples) {
  return Array.from(
    new Set(
      samples
        .map((sample) => sample.split(/[.!?\n]/).filter(Boolean).at(-1)?.trim())
        .filter((part) => part && part.length <= 32)
        .slice(0, 5),
    ),
  );
}

function buildStyleNotes({ informalScore, formalScore, emojiCount, sampleCount }) {
  const notes = [];
  notes.push("Keep replies short enough for WhatsApp.");
  if (informalScore > formalScore) notes.push("Use a friendly and familiar tone when clinically safe.");
  if (formalScore > informalScore) notes.push("Use a professional and measured tone.");
  if (emojiCount === 0) notes.push("Avoid emojis.");
  if (emojiCount > 0 && emojiCount / sampleCount <= 0.5) notes.push("Use emojis sparingly.");
  if (emojiCount / sampleCount > 0.5) notes.push("A small number of supportive emojis is acceptable.");
  return notes.join(" ");
}
