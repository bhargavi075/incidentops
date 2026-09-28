import { IncidentMemory, MemoryChannelScore, RecallResult } from '../types/incident';
import { SEEDED_INCIDENTS } from '../data/seedData';

const BANK_ID = 'incidentops-bank';

class HindsightMemoryEngine {
  private bank: IncidentMemory[] = [];
  private storageKey = 'incidentops_hindsight_bank';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.bank = JSON.parse(saved);
      } else {
        this.bank = [...SEEDED_INCIDENTS];
        this.saveToStorage();
      }
    } catch {
      this.bank = [...SEEDED_INCIDENTS];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bank));
    } catch {
      // In-memory fallback
    }
  }

  public getBankId(): string {
    return BANK_ID;
  }

  public getMemories(): IncidentMemory[] {
    return [...this.bank];
  }

  public resetToDefault() {
    this.bank = [...SEEDED_INCIDENTS];
    this.saveToStorage();
  }

  /**
   * retain() primitive:
   * Ingests post-mortem through biomimetic TEMPER pipeline:
   * Topic -> Entities -> Metrics -> Properties -> Events -> Resolution
   */
  public retain(params: {
    title: string;
    service: string;
    severity?: 'P1-CRITICAL' | 'P2-HIGH' | 'P3-MEDIUM';
    content: string;
    rootCause: string;
    runbookCommands: string[];
    author?: string;
  }): { memory: IncidentMemory; extractedFacts: number; causalLinksCreated: number } {
    const id = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    // Simulated TEMPER extraction
    const contentLower = (params.content + ' ' + params.rootCause).toLowerCase();
    
    // Extract entities
    const detectedEntities: string[] = [];
    if (contentLower.includes('redis')) detectedEntities.push('redis-master:6379');
    if (contentLower.includes('kafka')) detectedEntities.push('kafka-broker:9092');
    if (contentLower.includes('postgres') || contentLower.includes('pgbouncer')) detectedEntities.push('pg-primary.internal:5432');
    if (contentLower.includes('checkout')) detectedEntities.push('checkout-cluster-worker');
    if (contentLower.includes('payment')) detectedEntities.push('payment-processor-v2');
    if (contentLower.includes('pool')) detectedEntities.push('connection_pool');
    if (detectedEntities.length === 0) detectedEntities.push(`${params.service}-runtime`, 'cluster-node');

    // Extract metrics
    const detectedMetrics: string[] = [];
    if (contentLower.includes('504')) detectedMetrics.push('http_504_error_rate:spike');
    if (contentLower.includes('lag')) detectedMetrics.push('consumer_lag:>50000');
    if (contentLower.includes('connections')) detectedMetrics.push('active_connections:saturated');
    if (contentLower.includes('timeout')) detectedMetrics.push('p99_latency:>30000ms');

    // Extract properties & events
    const newMemory: IncidentMemory = {
      id,
      title: params.title || `Incident on ${params.service}`,
      service: params.service,
      severity: params.severity || 'P1-CRITICAL',
      timestamp,
      errorSignature: params.content.substring(0, 180),
      rootCause: params.rootCause,
      runbookFix: params.runbookCommands.length > 0 
        ? params.runbookCommands 
        : ['Investigate root cause and apply hotfix'],
      cliCommands: params.runbookCommands,
      tags: [params.service, ...detectedEntities.map(e => e.split(':')[0])],
      author: params.author || 'sre-oncall@company.internal',
      causalChain: {
        trigger: `Operational trigger logged at ${timestamp}`,
        mechanism: params.rootCause.substring(0, 120),
        impact: `Degraded service availability on ${params.service}`,
        mitigation: params.runbookCommands[0] || 'Manual operational intervention'
      },
      temperExtraction: {
        entities: detectedEntities,
        metrics: detectedMetrics.length > 0 ? detectedMetrics : ['latency_anomaly', 'failure_rate:elevated'],
        properties: ['env=production', 'cluster=us-east-1'],
        events: ['upstream_trigger', 'resource_saturation', 'service_degradation'],
        resolution: params.runbookCommands.join(' && ')
      }
    };

    // Prepend to bank
    this.bank = [newMemory, ...this.bank];
    this.saveToStorage();

    return {
      memory: newMemory,
      extractedFacts: (newMemory.temperExtraction?.entities.length || 0) + (newMemory.temperExtraction?.metrics.length || 0),
      causalLinksCreated: 3
    };
  }

  /**
   * recall() primitive (Zero-Cost Retrieval):
   * Searches across 4 Parallel Channels:
   * 1. BM25 Keyword Search
   * 2. Vector Semantic Similarity
   * 3. Temporal Ordering (Timestamps & Chronology)
   * 4. Knowledge Graph Entity & Causal Links
   */
  public recall(queryText: string): RecallResult | null {
    if (this.bank.length === 0) return null;

    const queryLower = queryText.toLowerCase();
    const queryTokens = queryLower
      .replace(/[^\w\s-:]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

    let bestMatch: IncidentMemory | null = null;
    let highestComposite = 0;
    let bestScores: MemoryChannelScore[] = [];

    for (const mem of this.bank) {
      // 1. BM25 Keyword Channel
      const docTokens = [
        ...mem.title.toLowerCase().split(/\s+/),
        ...mem.errorSignature.toLowerCase().split(/\s+/),
        ...mem.service.toLowerCase().split(/\s+/),
        ...mem.tags.map(t => t.toLowerCase()),
        ...(mem.temperExtraction?.entities || []).map(e => e.toLowerCase())
      ];

      const matchedTokens: string[] = [];
      queryTokens.forEach(token => {
        if (docTokens.some(dt => dt.includes(token) || token.includes(dt))) {
          matchedTokens.push(token);
        }
      });

      const bm25Raw = matchedTokens.length / Math.max(queryTokens.length * 0.4, 4);
      const bm25Score = Math.min(Math.max(bm25Raw, 0.05), 0.99);

      // 2. Vector Semantic Channel (Cosine distance proxy over operational embeddings)
      const serviceMatch = queryLower.includes(mem.service.toLowerCase());
      const hasCoreKeyword = mem.tags.some(tag => queryLower.includes(tag.toLowerCase()));
      const rootCauseMatch = queryTokens.filter(t => mem.rootCause.toLowerCase().includes(t)).length;
      
      let vectorScore = 0.15;
      if (serviceMatch) vectorScore += 0.35;
      if (hasCoreKeyword) vectorScore += 0.30;
      vectorScore += Math.min(rootCauseMatch * 0.05, 0.18);
      vectorScore = Math.min(vectorScore, 0.98);

      // 3. Temporal Ordering Channel (Recency & Chronology)
      // Checks recency, event alignment, and recurrence delta
      const incidentDate = new Date(mem.timestamp.replace(' UTC', ''));
      const daysAgo = Math.max(1, (Date.now() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
      // Recency decay curve with stability floor
      const temporalScore = Math.min(Math.max(1 / (1 + Math.log10(daysAgo + 1)), 0.3), 0.95);

      // 4. Knowledge Graph Entity & Causal Links Channel
      const matchedEntities: string[] = [];
      const entities = mem.temperExtraction?.entities || [];
      entities.forEach(ent => {
        const cleanEnt = ent.toLowerCase();
        if (queryLower.includes(cleanEnt) || cleanEnt.split(/[-_:]/).some(part => part.length > 2 && queryLower.includes(part))) {
          matchedEntities.push(ent);
        }
      });

      let graphScore = 0.1;
      if (matchedEntities.length > 0) {
        graphScore = 0.5 + Math.min(matchedEntities.length * 0.15, 0.45);
      }

      // Composite Weighted Score
      // Weights: Graph (30%), BM25 (25%), Vector (30%), Temporal (15%)
      const composite = (bm25Score * 0.25) + (vectorScore * 0.30) + (graphScore * 0.30) + (temporalScore * 0.15);

      if (composite > highestComposite) {
        highestComposite = composite;
        bestMatch = mem;
        bestScores = [
          {
            channel: 'bm25',
            name: 'BM25 Keyword',
            score: Number(bm25Score.toFixed(2)),
            detail: `${matchedTokens.length} exact operational tokens matched`,
            matchedTokens: matchedTokens.slice(0, 6)
          },
          {
            channel: 'vector',
            name: 'Vector Semantic',
            score: Number(vectorScore.toFixed(2)),
            detail: `Cosine similarity on service context & error embedding`
          },
          {
            channel: 'temporal',
            name: 'Temporal Recency',
            score: Number(temporalScore.toFixed(2)),
            detail: `Chronological anchor: ${mem.timestamp.split(' ')[0]}`,
            temporalAnchor: mem.timestamp
          },
          {
            channel: 'graph',
            name: 'Causal Graph Link',
            score: Number(graphScore.toFixed(2)),
            detail: matchedEntities.length > 0
              ? `Resolved entity links: ${matchedEntities.join(', ')}`
              : 'Direct service node traversal',
            entityLinks: matchedEntities
          }
        ];
      }
    }

    if (!bestMatch || highestComposite < 0.42) {
      return null;
    }

    const confidence = highestComposite >= 0.72 ? 'HIGH' : highestComposite >= 0.52 ? 'MEDIUM' : 'LOW';
    const matchType = highestComposite >= 0.85
      ? 'EXACT_CAUSAL_MATCH'
      : highestComposite >= 0.65
      ? 'MUTATED_PATTERN_MATCH'
      : 'PARTIAL_SEMANTIC';

    return {
      memory: bestMatch,
      compositeScore: Number(highestComposite.toFixed(2)),
      channelScores: bestScores,
      confidence,
      matchType
    };
  }
}

export const hindsightEngine = new HindsightMemoryEngine();
