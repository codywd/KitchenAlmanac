const SMART_DOUBLE_QUOTES = new Set(["\u201c", "\u201d", "\u201e", "\u201f"]);
const OPEN_BRACKETS = new Set(["{", "["]);
const CLOSE_BRACKET_BY_OPEN: Record<string, string> = {
  "[": "]",
  "{": "}",
};

export type JsonRepairResult<T = unknown> = {
  repaired: boolean;
  text: string;
  value: T;
};

export class JsonRepairError extends Error {
  constructor() {
    super("Could not parse JSON after applying common LLM JSON repairs.");
    this.name = "JsonRepairError";
  }
}

function isSmartDoubleQuote(character: string) {
  return SMART_DOUBLE_QUOTES.has(character);
}

function normalizeInput(text: string) {
  return text.replace(/^\uFEFF/, "").trim();
}

function stripMarkdownFence(text: string) {
  const match = text.match(/^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i);

  return match ? match[1].trim() : text;
}

function normalizeSmartQuoteDelimiters(text: string) {
  let result = "";
  let quoteMode: "ascii" | "smart" | null = null;
  let escaped = false;

  for (const character of text) {
    if (!quoteMode) {
      if (character === '"') {
        quoteMode = "ascii";
        result += character;
        continue;
      }

      if (isSmartDoubleQuote(character)) {
        quoteMode = "smart";
        result += '"';
        continue;
      }

      result += character;
      continue;
    }

    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaped = true;
      continue;
    }

    if (quoteMode === "ascii") {
      if (character === '"') {
        quoteMode = null;
      }

      result += character;
      continue;
    }

    if (isSmartDoubleQuote(character)) {
      quoteMode = null;
      result += '"';
      continue;
    }

    result += character === '"' ? '\\"' : character;
  }

  return result;
}

function removeTrailingCommas(text: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      result += character;

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ",") {
      let nextIndex = index + 1;

      while (/\s/.test(text[nextIndex] ?? "")) {
        nextIndex += 1;
      }

      if (text[nextIndex] === "}" || text[nextIndex] === "]") {
        continue;
      }
    }

    result += character;
  }

  return result;
}

function repairCommonLlmJsonIssues(text: string) {
  return removeTrailingCommas(
    normalizeSmartQuoteDelimiters(text).replace(/\u00a0/g, " "),
  ).trim();
}

function extractFirstJsonDocument(text: string) {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : undefined;

  if (start === undefined) {
    return null;
  }

  const stack: string[] = [];
  let quoteMode: "ascii" | "smart" | null = null;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (quoteMode) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (
        (quoteMode === "ascii" && character === '"') ||
        (quoteMode === "smart" && isSmartDoubleQuote(character))
      ) {
        quoteMode = null;
      }

      continue;
    }

    if (character === '"') {
      quoteMode = "ascii";
      continue;
    }

    if (isSmartDoubleQuote(character)) {
      quoteMode = "smart";
      continue;
    }

    if (OPEN_BRACKETS.has(character)) {
      stack.push(CLOSE_BRACKET_BY_OPEN[character]);
      continue;
    }

    if (character === "}" || character === "]") {
      if (stack.pop() !== character) {
        return null;
      }

      if (stack.length === 0) {
        return text.slice(start, index + 1).trim();
      }
    }
  }

  return null;
}

function addCandidate(candidates: string[], candidate: string | null) {
  if (candidate && !candidates.includes(candidate)) {
    candidates.push(candidate);
  }
}

export function parseJsonWithRepair<T = unknown>(input: string): JsonRepairResult<T> {
  const normalized = normalizeInput(input);
  const fenced = stripMarkdownFence(normalized);
  const extracted = extractFirstJsonDocument(fenced);
  const candidates: string[] = [];

  addCandidate(candidates, normalized);
  addCandidate(candidates, fenced);
  addCandidate(candidates, extracted);

  for (const candidate of [...candidates]) {
    addCandidate(candidates, repairCommonLlmJsonIssues(candidate));
  }

  for (const candidate of candidates) {
    try {
      return {
        repaired: candidate !== normalized,
        text: candidate,
        value: JSON.parse(candidate) as T,
      };
    } catch {
      // Keep trying progressively repaired candidates.
    }
  }

  throw new JsonRepairError();
}
