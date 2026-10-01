type ThreatIndicator = {
  type: string;
  evidence: string;
  severity: "low" | "medium" | "high";
};
type PrivacyFinding = {
  type: "email" | "phone" | "name" | "address" | "financial" | "credential" | "identifier" | "other";
  description: string;
  severity: "low" | "medium" | "high";
};
type SensitiveType = PrivacyFinding["type"];
type ScanAnalysis = {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  summary: string;
  threatIndicators: ThreatIndicator[];
  privacyFindings: PrivacyFinding[];
  recommendations: string[];
  trustConsiderations: string[];
};
type RedactionResult = {
  redactedText: string;
  categories: string[];
  findingCount: number;
};

type SensitiveMatch = {
  start: number;
  end: number;
  type: SensitiveType;
  severity: PrivacyFinding["severity"];
  label: string;
  replacement: string;
};

function collectMatches(
  content: string,
  pattern: RegExp,
  details: Omit<SensitiveMatch, "start" | "end">,
  matches: SensitiveMatch[],
  skipOverlap = false,
): void {
  pattern.lastIndex = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (
      skipOverlap &&
      matches.some((existing) => start < existing.end && end > existing.start)
    ) {
      continue;
    }
    matches.push({ start, end, ...details });
  }
}

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function findSensitiveMatches(content: string): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];

  collectMatches(
    content,
    /\b(?:password|passcode|pin|otp|one[- ]time code|verification code)\s*(?::|=|is)\s*[^\s,;]+/gi,
    {
      type: "credential",
      severity: "high",
      label: "Credential or verification code",
      replacement: "[REDACTED_CREDENTIAL]",
    },
    matches,
  );
  collectMatches(
    content,
    /\b(?:\d[ -]?){13,19}\b/g,
    {
      type: "financial",
      severity: "high",
      label: "Payment card number",
      replacement: "[REDACTED_FINANCIAL]",
    },
    matches,
  );
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const candidate = content.slice(matches[index].start, matches[index].end);
    if (matches[index].type === "financial" && !luhnValid(candidate)) {
      matches.splice(index, 1);
    }
  }
  collectMatches(
    content,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    {
      type: "identifier",
      severity: "high",
      label: "Government-ID-like number",
      replacement: "[REDACTED_IDENTIFIER]",
    },
    matches,
  );
  collectMatches(
    content,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    {
      type: "email",
      severity: "medium",
      label: "Email address",
      replacement: "[REDACTED_EMAIL]",
    },
    matches,
  );
  collectMatches(
    content,
    /\b(?:account|acct|routing)\s*(?:number|no\.?|#|:)\s*[A-Z0-9-]{6,}\b/gi,
    {
      type: "financial",
      severity: "high",
      label: "Account or routing detail",
      replacement: "[REDACTED_FINANCIAL]",
    },
    matches,
  );
  collectMatches(
    content,
    /\b(?:my name is|name is|name:)\s+[\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){0,2}/giu,
    {
      type: "name",
      severity: "medium",
      label: "Name",
      replacement: "[REDACTED_NAME]",
    },
    matches,
  );
  collectMatches(
    content,
    /\b\d{1,6}\s+[A-Z0-9][A-Za-z0-9.' -]{0,60}\s(?:street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|drive|dr\.|boulevard|blvd\.|court|ct\.|way)\b/gi,
    {
      type: "address",
      severity: "high",
      label: "Street address",
      replacement: "[REDACTED_ADDRESS]",
    },
    matches,
  );
  collectMatches(
    content,
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/g,
    {
      type: "phone",
      severity: "medium",
      label: "Phone number",
      replacement: "[REDACTED_PHONE]",
    },
    matches,
    true,
  );

  return matches.sort((left, right) => left.start - right.start || left.end - right.end);
}

function buildThreatIndicators(content: string): ThreatIndicator[] {
  const rules: Array<{
    type: string;
    pattern: RegExp;
    severity: ThreatIndicator["severity"];
  }> = [
    {
      type: "Urgency or pressure",
      pattern: /\b(?:urgent(?:ly)?|immediately|right away|act now|final notice|last warning|within \d+\s+(?:minutes?|hours?)|expires? today|suspended today)\b/gi,
      severity: "high",
    },
    {
      type: "Credential request",
      pattern: /\b(?:send|share|provide|confirm|verify|enter|reply with)\b.{0,40}\b(?:password|passcode|one[- ]time code|verification code|otp|login details)\b|\b(?:password|passcode|one[- ]time code|verification code|otp|login details)\b.{0,30}\b(?:send|share|provide|confirm|verify|enter|reply)\b/gi,
      severity: "high",
    },
    {
      type: "Payment request",
      pattern: /\b(?:gift cards?|wire transfer|bank transfer|cryptocurrency|bitcoin|payment|invoice)\b.{0,40}\b(?:immediately|today|now|urgent|to avoid|to restore)?|\b(?:pay|transfer|send money)\b.{0,30}\b(?:now|today|immediately|urgent)\b/gi,
      severity: "high",
    },
    {
      type: "Threatening language",
      pattern: /\b(?:arrest|legal action|prosecution|police|permanently (?:close|suspend|disable)|report you)\b/gi,
      severity: "medium",
    },
    {
      type: "Link or attachment instruction",
      pattern: /\b(?:click|tap|open|follow|download)\b.{0,30}\b(?:link|button|url|attachment|file)\b/gi,
      severity: "medium",
    },
    {
      type: "Possible impersonation",
      pattern: /\b(?:your (?:bank|it team|support desk|account provider)|i am (?:from|with) (?:it|support|your bank)|security team)\b/gi,
      severity: "low",
    },
  ];

  const indicators: ThreatIndicator[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(content);
    if (!match) continue;
    const evidence = match[0].trim().replace(/\s+/g, " ").slice(0, 160);
    indicators.push({
      type: rule.type,
      evidence,
      severity: rule.severity,
    });
  }
  return indicators;
}

function riskLevelFor(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 75) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export function analyzeContent(
  content: string,
  contextualUrl?: string,
): ScanAnalysis {
  const threatIndicators = buildThreatIndicators(content);
  const sensitiveMatches = findSensitiveMatches(content);
  const privacyFindings: PrivacyFinding[] = sensitiveMatches.map((match) => ({
    type: match.type,
    description: `${match.label} detected. Remove it before sharing if it is not needed.`,
    severity: match.severity,
  }));

  const threatPoints = threatIndicators.reduce(
    (total, indicator) =>
      total + (indicator.severity === "high" ? 24 : indicator.severity === "medium" ? 13 : 5),
    0,
  );
  const privacyPoints = privacyFindings.reduce(
    (total, finding) =>
      total + (finding.severity === "high" ? 10 : finding.severity === "medium" ? 6 : 3),
    0,
  );
  const riskScore = Math.min(100, 5 + threatPoints + privacyPoints);
  const riskLevel = riskLevelFor(riskScore);

  const recommendations = new Set<string>();
  if (threatIndicators.some((item) => item.type === "Credential request")) {
    recommendations.add("Do not share passwords, passcodes, or verification codes in response to an unexpected message.");
  }
  if (threatIndicators.some((item) => item.type === "Link or attachment instruction")) {
    recommendations.add("Avoid opening unexpected links or attachments; navigate to the official site independently.");
  }
  if (threatIndicators.some((item) => item.type === "Payment request")) {
    recommendations.add("Verify any payment request with the person or organization through a trusted, separate channel.");
  }
  if (threatIndicators.some((item) => item.type === "Urgency or pressure")) {
    recommendations.add("Pause before acting on urgent demands and verify the request independently.");
  }
  if (privacyFindings.length > 0) {
    recommendations.add("Remove sensitive details that the recipient does not need before sharing this text.");
  }
  if (recommendations.size === 0) {
    recommendations.add("Check the sender using an official contact method if the message asks you to take action.");
  }

  const trustConsiderations = [
    "These rule-based checks examine only the text you provided. A low score does not prove that a message or sender is safe.",
    "A detected phrase is a potential signal, not proof of malicious intent.",
  ];
  if (contextualUrl) {
    trustConsiderations.push("The supplied URL was treated as text and was not opened or verified.");
  } else if (/https?:\/\/\S+/i.test(content)) {
    trustConsiderations.push("Links were not opened or verified; only the text around them was checked.");
  }

  const summary =
    threatIndicators.length === 0 && privacyFindings.length === 0
      ? "No strong risk or sensitive-data patterns were found in the supplied text. This is not a guarantee of safety."
      : `${threatIndicators.length} potential security signal${threatIndicators.length === 1 ? "" : "s"} and ${privacyFindings.length} privacy finding${privacyFindings.length === 1 ? "" : "s"} were detected by text-based checks. Review the evidence before acting.`;

  return {
    riskLevel,
    riskScore,
    summary,
    threatIndicators,
    privacyFindings,
    recommendations: [...recommendations],
    trustConsiderations,
  };
}

export function redactContent(content: string): RedactionResult {
  const matches = findSensitiveMatches(content);
  let redactedText = content;
  for (const match of [...matches].sort((left, right) => right.start - left.start)) {
    redactedText =
      redactedText.slice(0, match.start) +
      match.replacement +
      redactedText.slice(match.end);
  }
  return {
    redactedText,
    categories: [...new Set(matches.map((match) => match.label))],
    findingCount: matches.length,
  };
}