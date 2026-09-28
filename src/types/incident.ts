export type Severity = 'P1-CRITICAL' | 'P2-HIGH' | 'P3-MEDIUM';

export interface MemoryChannelScore {
  channel: 'bm25' | 'vector' | 'temporal' | 'graph';
  name: string;
  score: number; // 0 to 1
  detail: string;
  matchedTokens?: string[];
  entityLinks?: string[];
  temporalAnchor?: string;
}

export interface IncidentMemory {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  timestamp: string; // e.g., '2026-09-27'
  errorSignature: string;
  rootCause: string;
  runbookFix: string[];
  cliCommands: string[];
  tags: string[];
  author: string;
  causalChain: {
    trigger: string;
    mechanism: string;
    impact: string;
    mitigation: string;
  };
  temperExtraction?: {
    entities: string[];
    metrics: string[];
    properties: string[];
    events: string[];
    resolution: string;
  };
}

export interface RecallResult {
  memory: IncidentMemory;
  compositeScore: number;
  channelScores: MemoryChannelScore[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchType: 'EXACT_CAUSAL_MATCH' | 'MUTATED_PATTERN_MATCH' | 'PARTIAL_SEMANTIC' | 'NOVEL';
}

export interface TriageAnalysis {
  status: 'KNOWN_INCIDENT' | 'NOVEL_OUTAGE';
  confidenceScore: number; // 0 to 100
  confidenceRating: 'High Confidence' | 'Medium Confidence' | 'Low / Generic Confidence';
  recalledMemory?: RecallResult;
  latencyMs: number;
  retrievalCostTokens: number;
  retrievalCostDollars: number;
  inferenceModel: string;
  rootCauseSummary: string;
  impactAssessment: string;
  recommendedRunbook: {
    stepNumber: number;
    description: string;
    command: string;
    safetyPrecheck?: string;
    expectedOutput?: string;
  }[];
  rawGroqResponse?: string;
  genericFallbackAdvice?: string[];
  safetyReport?: {
    isSafe: boolean;
    badge: string;
    status: 'SAFE' | 'HIGH_RISK';
    violations: string[];
    recommendation: string;
  };
  statelessComparison?: {
    diagnosis: string;
    model: string;
    latencyMs: number;
    runbook: { stepNumber: number; description: string; command: string }[];
    safetyReport?: { isSafe: boolean; badge: string };
  };
}

export interface LogPreset {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  scenario: 'Redis Pool Exhaustion' | 'Kafka Deserialization' | 'PostgreSQL Saturation' | 'Mutated Checkout Alert' | 'Novel Kubernetes OOM';
  logSnippet: string;
  isMutated?: boolean;
  isNovel?: boolean;
}
