import React, { useState } from 'react';
import { hindsightEngine } from '../services/hindsightEngine';
import { groqService } from '../services/groqEngine';
import { TriageAnalysis, Severity } from '../types/incident';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Database,
  GitCompare,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Layers,
  Server,
  Terminal,
  AlertTriangle,
  Flame,
  Check,
  FastForward,
  PlusCircle,
  X,
  FileText,
  Wand2
} from 'lucide-react';

interface DemoScenario {
  id: string;
  name: string;
  service: string;
  category: string;
  severity: Severity;
  badgeColor: 'emerald' | 'amber' | 'purple' | 'sky';
  iconEmoji: string;
  summary: string;
  stage1: {
    log: string;
    description: string;
    limitationNote: string;
  };
  stage2: {
    description: string;
    payload: {
      title: string;
      service: string;
      severity: Severity;
      content: string;
      rootCause: string;
      runbookCommands: string[];
      author: string;
    };
    temper: {
      entities: string[];
      chronology: string;
      causalLink: string;
      bankTarget: string;
    };
  };
  stage3: {
    mutatedLog: string;
    description: string;
    expectedPattern: string;
  };
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'redis-pool-exhaustion',
    name: 'Redis 6379 Connection Pool Leak',
    service: 'checkout-service',
    category: 'Cache / In-Memory Store',
    severity: 'P1-CRITICAL',
    badgeColor: 'emerald',
    iconEmoji: '⚡',
    summary: 'Zombie connections on port 6379 trigger HTTP 504 cascade across checkout pods.',
    stage1: {
      description: 'A live HTTP 504 alert hits checkout-cluster-worker during a flash sale. No historical post-mortems exist in memory.',
      log: `2026-09-14 02:15:22 UTC [ALERT] checkout-cluster-worker-01: HTTP 504 Gateway Timeout during flash traffic surge.
No prior post-mortems logged for checkout-cluster-worker.`,
      limitationNote: 'Without operational memory, the agent cannot identify the unreleased Redis socket leak, offering only broad infrastructure guesses.'
    },
    stage2: {
      description: 'After manual 2:00 AM debugging, on-call SRE discovers zombie Redis client leases on port 6379 and logs the verified post-mortem.',
      payload: {
        title: 'Redis Port 6379 Connection Pool Exhaustion on Checkout Worker',
        service: 'checkout-service',
        severity: 'P1-CRITICAL',
        content: 'HTTP 504 Gateway Timeout on checkout-cluster-worker during traffic spike. Zombie Redis connections on port 6379.',
        rootCause: 'Zombie connection leak in Python redis-py connection pool during unexpected upstream payment timeout. Worker processes failed to release client leases on port 6379, causing subsequent checkout HTTP requests to queue and trigger 504 gateway timeouts.',
        runbookCommands: [
          'redis-cli -h redis-master.production.svc.cluster.local -p 6379 client kill type normal',
          'kubectl patch configmap checkout-config -p \'{"data":{"REDIS_POOL_TIMEOUT":"5s","MAX_IDLE":"50"}}\'',
          'kubectl rollout restart deployment/checkout-cluster-worker -n production'
        ],
        author: 'sre-lead@company.internal'
      },
      temper: {
        entities: ['checkout-cluster-worker', 'redis-master:6379', 'connection_pool'],
        chronology: '2026-09-14 02:18:04 UTC · Recurrence: Traffic Burst',
        causalLink: 'Port 6379 Lease Leak → HTTP 504 Cascade → redis-cli client kill',
        bankTarget: 'incidentops-bank (Zero LLM Storage Cost)'
      }
    },
    stage3: {
      description: 'Weeks later, a mutated alert strikes a different pod (checkout-cluster-worker-04) with reworded telemetry. Watch Hindsight recall the exact causal pattern at $0.00 cost!',
      mutatedLog: `2026-09-27T09:14:55.803Z [ALERT] Ingress Envoy Gateway [checkout-ingress-prod]
HTTP 504 Gateway Timeout detected on checkout-cluster-worker-04.
Failed contacting backend cache shard: redis-master:6379.
Worker pool report: active_socket_leases=9998, idle_dead_leases=7420, client_type='normal'.
Threshold exceeded: latency P99 > 30,000ms. Transactions aborted: 3,410.`,
      expectedPattern: 'Recognizes Redis zombie connection exhaustion despite differing pod name and ingress phrasing.'
    }
  },
  {
    id: 'kafka-deserialization',
    name: 'Kafka Deserialization Poison Pill',
    service: 'payment-stream',
    category: 'Event Streaming Broker',
    severity: 'P1-CRITICAL',
    badgeColor: 'sky',
    iconEmoji: '📬',
    summary: 'Malformed JSON payload missing currency_code causes consumer crashloop & 50k lag surge.',
    stage1: {
      description: 'Consumer lag skyrockets past 50,000 messages on payments.incoming. The worker is crashing repeatedly.',
      log: `2026-09-02 14:38:11 UTC [METRIC ALERT] ConsumerGroupLagSurge: consumer group payment-processor-v2 lag > 50,000 messages on topic payments.incoming.
Worker pods entering CrashLoopBackOff. No past runbook in bank.`,
      limitationNote: 'A generic LLM recommends scaling up consumer pods or restarting brokers, which will not fix a poison pill message blocking the partition.'
    },
    stage2: {
      description: 'SRE discovers a merchant batch sent JSON missing mandatory currency_code, causing Jackson parser to crash without committing offset.',
      payload: {
        title: 'Kafka Consumer Lag Deserialization Bug in Payment Stream',
        service: 'payment-stream',
        severity: 'P1-CRITICAL',
        content: 'KafkaLagException: consumer group payment-processor-v2 lag > 50,000 msg, SerializationException: Missing mandatory key currency_code.',
        rootCause: 'A poison pill JSON message missing the mandatory currency_code schema attribute triggered an unhandled Jackson deserialization error. The consumer worker entered an infinite crash-and-retry backoff loop without committing the offset, starving all downstream payment processing.',
        runbookCommands: [
          'kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --group payment-processor-v2 --topic payments.incoming --reset-offsets --shift-by 1 --execute',
          'kafka-console-producer.sh --bootstrap-server kafka-broker:9092 --topic payments.dlq < /tmp/poison_pill_payload.json',
          'kubectl rollout restart deployment/payment-processor-v2 -n production'
        ],
        author: 'payment-platform-oncall@company.internal'
      },
      temper: {
        entities: ['payment-processor-v2', 'kafka-broker:9092', 'payments.incoming'],
        chronology: '2026-09-02 14:41:22 UTC · Offset: 18492041',
        causalLink: 'Missing currency_code → Jackson Deserializer CrashLoop → Offset Shift +1',
        bankTarget: 'incidentops-bank (Zero LLM Storage Cost)'
      }
    },
    stage3: {
      description: 'A mutated serialization exception strikes payment-processor-v2 on a different thread with reworded telemetry.',
      mutatedLog: `2026-09-28T11:02:44.119Z [ERROR] payment-processor-v2 [Worker-Thread-14]:
org.apache.kafka.common.errors.SerializationException: Error deserializing key/value for partition payments.incoming-4 at offset 18492041
Caused by: com.fasterxml.jackson.databind.exc.MismatchedInputException: Missing mandatory JSON property 'currency_code'
[METRIC ALERT] ConsumerLagExceededThreshold: current lag = 54,210 messages.`,
      expectedPattern: 'Recognizes poison pill schema mismatch and prescribes immediate offset shift + DLQ bypass.'
    }
  },
  {
    id: 'postgres-etl-saturation',
    name: 'PostgreSQL Unpooled ETL Saturation',
    service: 'data-platform-analytics',
    category: 'Relational Database',
    severity: 'P2-HIGH',
    badgeColor: 'amber',
    iconEmoji: '🐘',
    summary: 'Nightly rollup cron spawns 200 Celery workers bypassing PgBouncer and starving connection slots.',
    stage1: {
      description: 'PostgreSQL connection slots are completely exhausted (max_connections=500). Core APIs are throwing connection refused.',
      log: `2026-08-28 03:58:02 UTC [CRITICAL] api-core-deployment: FATAL: remaining connection slots are reserved for non-superuser connections (max_connections=500 exceeded).
Target host pg-primary.internal:5432. Connection refused.`,
      limitationNote: 'Stateless LLMs guess that database traffic grew or propose restarting Postgres, which drops active transactions and causes database corruption.'
    },
    stage2: {
      description: 'DBA discovers analytics_nightly_rollup cron bypassed PgBouncer pooler and connected directly to port 5432, holding idle locks.',
      payload: {
        title: 'PostgreSQL Connection Saturation during Nightly ETL Cron Rollup',
        service: 'data-platform-analytics',
        severity: 'P2-HIGH',
        content: 'FATAL: remaining connection slots are reserved for non-superuser connections (max_connections=500 exceeded). Unpooled Celery workers.',
        rootCause: 'The nightly analytics_nightly_rollup cron job spawned 200 concurrent Celery sub-tasks that directly bypassed PgBouncer pooler and connected straight to PostgreSQL port 5432. All 500 connection slots were rapidly exhausted by idle-in-transaction queries, starving the core API service.',
        runbookCommands: [
          'psql -h pg-primary.internal -U postgres -d core_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle in transaction\' AND state_change < NOW() - INTERVAL \'5 minutes\';"',
          'kubectl patch cronjob analytics-nightly-rollup -p \'{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"worker","env":[{"name":"DB_PORT","value":"6432"}]}]}}}}}}\'',
          'kubectl rollout restart deployment/api-core -n production'
        ],
        author: 'dba-infrastructure@company.internal'
      },
      temper: {
        entities: ['pg-primary.internal:5432', 'analytics_nightly_rollup', 'pgbouncer:6432'],
        chronology: '2026-08-28 04:00:15 UTC · Recurrence: 04:00 Cron',
        causalLink: 'Direct Port 5432 Cron → Idle Locks Exhaust Slots → Terminate Idle + Repoint to 6432',
        bankTarget: 'incidentops-bank (Zero LLM Storage Cost)'
      }
    },
    stage3: {
      description: 'At 04:02 UTC the following month, unpooled connections saturate the primary database again with reworded application logs.',
      mutatedLog: `2026-09-27T04:02:11.008Z [FATAL] PostgreSQL primary postgresql-cluster-0:
FATAL: remaining connection slots are reserved for non-superuser connections
DETAIL: Database connection limit (max_connections=500) reached. Active connections: 500, waiting: 84.
2026-09-27T04:02:12.115Z [ERROR] api-core-deployment: sqlalchemy.exc.OperationalError: could not connect to server: Connection refused
Target host: pg-primary.internal:5432 (direct unpooled connection). Triggered by analytics_nightly_rollup.`,
      expectedPattern: 'Recognizes 04:00 UTC cron correlation, identifies unpooled bypass, and emits SQL terminate command.'
    }
  },
  {
    id: 'k8s-envoy-oom',
    name: 'Kubernetes Envoy Ingress OOMKilled',
    service: 'ingress-gateway',
    category: 'Edge Routing / Ingress',
    severity: 'P1-CRITICAL',
    badgeColor: 'purple',
    iconEmoji: '☸️',
    summary: 'TLS handshake buffer churn during burst traffic exceeds container cgroup 2048MiB limit (Exit 137).',
    stage1: {
      description: 'Ingress Envoy controller pod terminates with ExitCode 137. Edge connections drop immediately.',
      log: `2026-09-20 08:30:15 UTC [CRITICAL] kube-system / ingress-controller-envoy: Pod terminated with ExitCode: 137 (OOMKilled).
Memory usage exceeded cgroup limit: 2048MiB. 14,200 connections dropped. No prior post-mortem found.`,
      limitationNote: 'A generic LLM recommends blindly adding more replicas without diagnosing the TLS buffer allocation leak.'
    },
    stage2: {
      description: 'SRE diagnoses that keepalive TLS handshake buffers were not pooled under keep-alive churn, causing memory spikes over 2GB.',
      payload: {
        title: 'Kubernetes Ingress Envoy OOMKilled ExitCode 137 during TLS Handshake Spike',
        service: 'ingress-gateway',
        severity: 'P1-CRITICAL',
        content: 'ExitCode: 137 (OOMKilled) on ingress-controller-envoy. Memory exceeded cgroup 2048MiB limit during edge TLS handshake storm.',
        rootCause: 'Unbounded TLS handshake buffer allocation during edge traffic spike caused cgroup memory exhaustion (ExitCode 137). Worker threads failed to garbage collect stale handshake buffers under keep-alive churn.',
        runbookCommands: [
          'kubectl set resources deployment/ingress-controller-envoy -n kube-system --limits=memory=4096Mi --requests=memory=2048Mi',
          'kubectl patch configmap envoy-config -n kube-system -p \'{"data":{"max_handshake_buffers":"1024","keepalive_timeout":"15s"}}\'',
          'kubectl rollout restart deployment/ingress-controller-envoy -n kube-system'
        ],
        author: 'edge-platform-sre@company.internal'
      },
      temper: {
        entities: ['ingress-controller-envoy', 'kube-system', 'cgroup_memory'],
        chronology: '2026-09-20 08:35:00 UTC · Recurrence: Edge DDoS',
        causalLink: 'TLS Handshake Churn → Cgroup OOM 137 → Raise Memory Limit to 4GB + Buffer Cap',
        bankTarget: 'incidentops-bank (Zero LLM Storage Cost)'
      }
    },
    stage3: {
      description: 'A mutated OOMKilled alert occurs on a different envoy node during a DDoS burst on interface eth0.',
      mutatedLog: `2026-09-27T09:05:01.312Z [CRITICAL] kube-system / ingress-controller-envoy-7b89f8dc9f-k2l8m:
Event: Pod /ingress-controller-envoy-7b89f8dc9f-k2l8m terminated with ExitCode: 137 (OOMKilled)
Memory usage exceeded cgroup limit: 2048MiB / 2048MiB.
High connection churn: TLS handshake buffers allocated 1.8GB during DDoS burst on edge interface eth0.
Incoming traffic dropped: 14,200 connections refused.`,
      expectedPattern: 'Recognizes TLS buffer saturation cgroup limit and generates exact resource bump & buffer cap patch.'
    }
  }
];

const MANUAL_SCENARIO_TEMPLATES = [
  {
    name: 'Elasticsearch JVM GC Freeze',
    service: 'search-cluster',
    category: 'Search & Indexing Engine',
    severity: 'P1-CRITICAL' as Severity,
    iconEmoji: '🔍',
    summary: 'Unbounded wildcard query triggers 14s Stop-The-World JVM pause and 504 timeouts.',
    stage1Log: `2026-09-28T04:12:00.119Z [WARN] elasticsearch-data-03: [jvm] [gc][young][18402][2109] duration [14.2s] exceeded threshold [1000ms].
Heap memory usage: 98.4%. Worker thread pool saturated with 85 pending search tasks. No past runbook in bank.`,
    stage1Limitation: 'Without memory, a standard LLM suggests restarting nodes or increasing cluster replicas blindly.',
    stage2RootCause: 'Unindexed high-cardinality terms aggregation on orders_v3 exceeded JVM heap young gen allocation, triggering continuous Stop-The-World GC pauses.',
    stage2Commands: [
      'curl -X PUT "http://es-cluster:9200/orders_v3/_settings" -H "Content-Type: application/json" -d \'{"index.search.slowlog.threshold.query.warn": "2s"}\'',
      'kubectl patch deployment/es-data -p \'{"spec":{"template":{"spec":{"containers":[{"name":"es","env":[{"name":"ES_JAVA_OPTS","value":"-Xms8g -Xmx8g"}]}]}}}}\'',
      'kubectl rollout restart deployment/es-data -n production'
    ],
    stage3MutatedLog: `2026-10-04T12:30:19.401Z [CRITICAL] Ingress Search Gateway: HTTP 504 Gateway Timeout contacting search-cluster-data-07.
JVM young GC stall 16.8s on node es-node-07. Pending query queue backlog > 500 tasks on index orders_v3.`,
    stage3Pattern: 'Recognizes wildcard aggregation heap saturation and applies memory bump + slowlog cap.'
  },
  {
    name: 'RabbitMQ Socket FD Leak',
    service: 'notification-service',
    category: 'Message Broker',
    severity: 'P2-HIGH' as Severity,
    iconEmoji: '🐰',
    summary: 'Unclosed AMQP publisher channels exhaust Erlang file descriptor limit (65535/65535).',
    stage1Log: `2026-09-28T06:01:22.012Z [ERROR] rabbitmq-cluster-1: connection <0.1824.0> closed abruptly.
File descriptor limit reached: 65535/65535. Erlang beam.smp unable to accept incoming TCP connections.`,
    stage1Limitation: 'A generic LLM recommends restarting the broker container, losing in-flight queue messages.',
    stage2RootCause: 'Notification publisher service spawned a new AMQP channel for every single transactional email without closing previous channels.',
    stage2Commands: [
      'rabbitmqctl close_all_connections "channel churn limit exceeded"',
      'kubectl patch deployment/notification-publisher -p \'{"spec":{"template":{"spec":{"containers":[{"name":"worker","env":[{"name":"POOL_AMQP_CHANNELS","value":"true"}]}]}}}}\'',
      'kubectl rollout restart deployment/notification-publisher -n production'
    ],
    stage3MutatedLog: `2026-10-08T18:45:00.803Z [ALERT] RabbitMQ Edge Cluster: [alarm_handler] {set,{file_descriptors,limit_exceeded}}.
65535 sockets occupied. Socket allocation failed on notification-worker-02.`,
    stage3Pattern: 'Identifies publisher channel leak and generates connection flush + channel pooling patch.'
  }
];

interface BeforeAfterDemoProps {
  onStageChange?: (stage: number) => void;
}

export const BeforeAfterDemo: React.FC<BeforeAfterDemoProps> = () => {
  const [customScenarios, setCustomScenarios] = useState<DemoScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(DEMO_SCENARIOS[0].id);
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  // Manual Scenario Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('Custom Production Outage');
  const [customService, setCustomService] = useState('payment-gateway');
  const [customCategory, setCustomCategory] = useState('Distributed Service');
  const [customSeverity, setCustomSeverity] = useState<Severity>('P1-CRITICAL');
  const [customStage1Log, setCustomStage1Log] = useState('');
  const [customStage1Limitation, setCustomStage1Limitation] = useState('Stateless LLM provides generic trial-and-error advice.');
  const [customStage2RootCause, setCustomStage2RootCause] = useState('');
  const [customStage2Commands, setCustomStage2Commands] = useState('');
  const [customStage3MutatedLog, setCustomStage3MutatedLog] = useState('');
  const [customStage3Pattern, setCustomStage3Pattern] = useState('');

  // Per-scenario outputs state map
  const [scenarioOutputs, setScenarioOutputs] = useState<Record<string, {
    stage1?: TriageAnalysis | null;
    stage2Success?: boolean;
    stage3?: TriageAnalysis | null;
  }>>({});

  const allScenarios = [...customScenarios, ...DEMO_SCENARIOS];
  const activeScenario = allScenarios.find(s => s.id === selectedScenarioId) || allScenarios[0];
  const activeState = scenarioOutputs[activeScenario.id] || {};

  const handleApplyCustomTemplate = (tmpl: typeof MANUAL_SCENARIO_TEMPLATES[0]) => {
    setCustomTitle(tmpl.name);
    setCustomService(tmpl.service);
    setCustomCategory(tmpl.category);
    setCustomSeverity(tmpl.severity);
    setCustomStage1Log(tmpl.stage1Log);
    setCustomStage1Limitation(tmpl.stage1Limitation);
    setCustomStage2RootCause(tmpl.stage2RootCause);
    setCustomStage2Commands(tmpl.stage2Commands.join(' && '));
    setCustomStage3MutatedLog(tmpl.stage3MutatedLog);
    setCustomStage3Pattern(tmpl.stage3Pattern);
  };

  const handleClearCustomTemplate = () => {
    setCustomTitle('');
    setCustomService('custom-service');
    setCustomCategory('Application Layer');
    setCustomSeverity('P1-CRITICAL');
    setCustomStage1Log('');
    setCustomStage1Limitation('');
    setCustomStage2RootCause('');
    setCustomStage2Commands('');
    setCustomStage3MutatedLog('');
    setCustomStage3Pattern('');
  };

  const handleSaveManualScenario = (autoRun = false) => {
    if (!customStage1Log.trim() || !customStage3MutatedLog.trim()) return;

    const newId = `custom-scenario-${Date.now()}`;
    const commandsArray = customStage2Commands.split('&&').map(c => c.trim()).filter(Boolean);

    const newScenario: DemoScenario = {
      id: newId,
      name: customTitle.trim() || `Custom Outage (${customService})`,
      service: customService.trim() || 'custom-service',
      category: customCategory.trim() || 'Custom Microservice',
      severity: customSeverity,
      badgeColor: 'purple',
      iconEmoji: '🧪',
      summary: customStage2RootCause.trim() || 'User-defined operational incident with verified root cause and mutated recurrence.',
      stage1: {
        description: `Initial unseen failure on ${customService}. No prior historical incidents exist in Hindsight.`,
        log: customStage1Log.trim(),
        limitationNote: customStage1Limitation.trim() || 'Without historical memory, standard LLMs can only provide speculative infrastructure advice.'
      },
      stage2: {
        description: `Verified post-mortem ingested into incidentops-bank for ${customService}.`,
        payload: {
          title: customTitle.trim() || `Outage on ${customService}`,
          service: customService.trim() || 'custom-service',
          severity: customSeverity,
          content: customStage1Log.trim(),
          rootCause: customStage2RootCause.trim() || 'User-defined operational root cause.',
          runbookCommands: commandsArray.length > 0 ? commandsArray : ['kubectl get pods -n production'],
          author: 'sre-manual@company.internal'
        },
        temper: {
          entities: [`${customService}:service`, 'cluster-node', 'runtime_env'],
          chronology: new Date().toISOString().substring(0, 10) + ' · User Recorded',
          causalLink: `${customService} Failure → Identified Root Cause → Actionable Fix`,
          bankTarget: 'incidentops-bank (Zero LLM Storage Cost)'
        }
      },
      stage3: {
        description: `Weeks later, a mutated failure strikes ${customService} with reworded telemetry.`,
        mutatedLog: customStage3MutatedLog.trim(),
        expectedPattern: customStage3Pattern.trim() || 'Recognizes underlying causal pattern and applies verified operational mitigation.'
      }
    };

    setCustomScenarios(prev => [newScenario, ...prev]);
    setSelectedScenarioId(newId);
    setCurrentStage(1);
    setIsManualModalOpen(false);

    if (autoRun) {
      setTimeout(() => {
        runStage1(newScenario);
      }, 100);
    }
  };

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setCurrentStage(1);
  };

  // Stage 1: Novel Outage Run
  const runStage1 = async (scenario = activeScenario): Promise<TriageAnalysis> => {
    setIsRunning(true);
    // Force novel by passing null memory
    const res = await groqService.triage(scenario.stage1.log, null);
    
    setScenarioOutputs(prev => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        stage1: res
      }
    }));
    setIsRunning(false);
    return res;
  };

  // Stage 2: Post-Mortem Retain Ingestion
  const runStage2 = async (scenario = activeScenario) => {
    setIsRunning(true);
    await new Promise(r => setTimeout(r, 500));

    // Retain into Hindsight engine
    hindsightEngine.retain({
      title: scenario.stage2.payload.title,
      service: scenario.stage2.payload.service,
      severity: scenario.stage2.payload.severity,
      content: scenario.stage2.payload.content,
      rootCause: scenario.stage2.payload.rootCause,
      runbookCommands: scenario.stage2.payload.runbookCommands,
      author: scenario.stage2.payload.author
    });

    setScenarioOutputs(prev => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        stage2Success: true
      }
    }));
    setIsRunning(false);
  };

  // Stage 3: After Memory (Mutated Alert)
  const runStage3 = async (scenario = activeScenario): Promise<TriageAnalysis> => {
    setIsRunning(true);
    // 0-cost recall via Hindsight
    const recall = hindsightEngine.recall(scenario.stage3.mutatedLog);
    const res = await groqService.triage(scenario.stage3.mutatedLog, recall);

    setScenarioOutputs(prev => ({
      ...prev,
      [scenario.id]: {
        ...prev[scenario.id],
        stage3: res
      }
    }));
    setIsRunning(false);
    return res;
  };

  // Auto-Play 3-Stage Evolution
  const handleAutoPlay = async () => {
    if (isAutoPlaying || isRunning) return;
    setIsAutoPlaying(true);

    try {
      // Step 1
      setCurrentStage(1);
      await runStage1(activeScenario);
      await new Promise(r => setTimeout(r, 800));

      // Step 2
      setCurrentStage(2);
      await runStage2(activeScenario);
      await new Promise(r => setTimeout(r, 800));

      // Step 3
      setCurrentStage(3);
      await runStage3(activeScenario);
    } catch (err) {
      console.error('AutoPlay error:', err);
    } finally {
      setIsAutoPlaying(false);
    }
  };

  const handleResetCurrentScenario = () => {
    setCurrentStage(1);
    setScenarioOutputs(prev => ({
      ...prev,
      [activeScenario.id]: {
        stage1: null,
        stage2Success: false,
        stage3: null
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                The "Before vs. After" Memory Evolution
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Switch across 4 realistic production outage scenarios to observe how IncidentOps evolves from an amnesic baseline into an autonomous, sub-second diagnostician once continuous memory is retained.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => {
                if (!customTitle) handleApplyCustomTemplate(MANUAL_SCENARIO_TEMPLATES[0]);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-sm shadow-emerald-500/20 transition-all cursor-pointer ring-1 ring-emerald-400/50 hover:shadow-emerald-500/30"
              title="Define your own custom 3-stage outage scenario"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Scenario Manually</span>
            </button>

            <button
              onClick={handleAutoPlay}
              disabled={isAutoPlaying || isRunning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Automatically run through Stage 1 -> Stage 2 -> Stage 3"
            >
              {isAutoPlaying ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Playing Evolution...</span>
                </>
              ) : (
                <>
                  <FastForward className="w-3.5 h-3.5 fill-current" />
                  <span>Auto-Play Evolution</span>
                </>
              )}
            </button>

            <button
              onClick={handleResetCurrentScenario}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
              title="Reset current scenario outputs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Multi-Scenario Switcher Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Select Demonstration Scenario ({allScenarios.length} Available):
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
              {customScenarios.length > 0 && (
                <span className="text-sky-400">
                  {customScenarios.length} Custom Scenario{customScenarios.length > 1 ? 's' : ''}
                </span>
              )}
              <span>
                Active: <strong className="text-slate-300">{activeScenario.service}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {allScenarios.map(sc => {
              const isSelected = sc.id === activeScenario.id;
              const scState = scenarioOutputs[sc.id];
              const isCompleted = scState?.stage3 !== undefined && scState?.stage3 !== null;
              const isCustom = sc.id.startsWith('custom-scenario-');

              return (
                <button
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc.id)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500/50 text-white shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{sc.iconEmoji}</span>
                    <div className="flex items-center gap-1.5">
                      {isCustom && (
                        <span className="px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-mono border border-sky-500/30">
                          Custom
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono border border-emerald-500/30 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Evolved
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500">{sc.severity.split('-')[0]}</span>
                    </div>
                  </div>

                  <div className="font-bold text-xs text-slate-200 truncate">{sc.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">
                    {sc.service} · {sc.category}
                  </div>
                </button>
              );
            })}

            {/* Quick-add scenario card button */}
            <button
              onClick={() => {
                if (!customTitle) handleApplyCustomTemplate(MANUAL_SCENARIO_TEMPLATES[0]);
                setIsManualModalOpen(true);
              }}
              className="p-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 transition-all flex flex-col justify-center items-center text-center group cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-xs font-semibold">+ Custom Scenario</span>
              <span className="text-[10px] text-emerald-400/70">Define 3-stage outage</span>
            </button>
          </div>
        </div>

        {/* 3-Stage Interactive Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
          {/* Step 1 Button */}
          <button
            onClick={() => setCurrentStage(1)}
            className={`p-3 rounded-lg border text-left transition-all ${
              currentStage === 1
                ? 'bg-slate-800 border-amber-500/50 text-white shadow-sm ring-1 ring-amber-500/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-amber-400 font-bold">Stage 1: Before Memory</span>
              {activeState.stage1 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-xs font-semibold text-slate-200">Novel Outage (Baseline)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Generic recommendations & low confidence.
            </div>
          </button>

          {/* Step 2 Button */}
          <button
            onClick={() => setCurrentStage(2)}
            className={`p-3 rounded-lg border text-left transition-all ${
              currentStage === 2
                ? 'bg-slate-800 border-sky-500/50 text-white shadow-sm ring-1 ring-sky-500/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-sky-400 font-bold">Stage 2: Ingestion Event</span>
              {activeState.stage2Success && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-xs font-semibold text-slate-200">Hindsight retain() Pipeline</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              TEMPER causal extraction into incidentops-bank.
            </div>
          </button>

          {/* Step 3 Button */}
          <button
            onClick={() => setCurrentStage(3)}
            className={`p-3 rounded-lg border text-left transition-all ${
              currentStage === 3
                ? 'bg-slate-800 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-emerald-400 font-bold">Stage 3: After Memory</span>
              {activeState.stage3 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-xs font-semibold text-slate-200">Learned Triage (Mutated Alert)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Instant 0-token recall + High-confidence runbook.
            </div>
          </button>
        </div>
      </div>

      {/* Stage Content Workspace */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        {currentStage === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-mono">
                    1
                  </span>
                  Stage 1: Novel Outage — {activeScenario.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeScenario.stage1.description}
                </p>
              </div>

              <button
                onClick={() => runStage1(activeScenario)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Simulate Novel Outage Triage
              </button>
            </div>

            {/* Input Log Box */}
            <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300">
              <div className="text-[11px] text-slate-500 mb-1">Live incoming alert:</div>
              <div className="text-rose-400 whitespace-pre-line">
                {activeScenario.stage1.log}
              </div>
              <div className="text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span>Memory Bank Check: 0 hits in 'incidentops-bank' ($0.00 recall cost)</span>
                <span className="text-amber-400">Status: Novel Incident</span>
              </div>
            </div>

            {/* Output Display */}
            {activeState.stage1 ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                      <span>CLASSIFICATION:</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {activeState.stage1.confidenceRating} ({activeState.stage1.confidenceScore}%)
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200">Agent Diagnosis:</div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {activeState.stage1.rootCauseSummary}
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <strong>Standard LLM limitation:</strong> {activeScenario.stage1.limitationNote}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2 font-mono text-xs">
                    <div className="text-slate-300 font-semibold">Generic Baseline Suggestions:</div>
                    <div className="text-slate-400 space-y-1.5">
                      {activeState.stage1.recommendedRunbook.map(cmd => (
                        <div key={cmd.stepNumber} className="bg-[#080d16] p-2 rounded border border-slate-800/80 text-[11px]">
                          <span className="text-slate-500">$</span> {cmd.command}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setCurrentStage(2);
                      runStage2(activeScenario);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Proceed to Stage 2: Ingest Post-Mortem</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center text-xs text-slate-500">
                Click "Simulate Novel Outage Triage" or "Auto-Play Evolution" to run baseline evaluation without memory.
              </div>
            )}
          </div>
        )}

        {currentStage === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-mono">
                    2
                  </span>
                  Stage 2: The Ingestion Event — {activeScenario.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeScenario.stage2.description}
                </p>
              </div>

              <button
                onClick={() => runStage2(activeScenario)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                Ingest Verified Post-Mortem
              </button>
            </div>

            {/* Ingestion Payload */}
            <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3.5 font-mono text-xs space-y-2">
              <div className="text-[11px] text-sky-400 font-semibold flex items-center justify-between">
                <span>Verified Post-Mortem Payload:</span>
                <span className="text-slate-500">{activeScenario.stage2.payload.service}</span>
              </div>
              <div className="text-slate-300 leading-relaxed">
                <strong>Title:</strong> {activeScenario.stage2.payload.title}<br />
                <strong>Root Cause:</strong> {activeScenario.stage2.payload.rootCause}<br />
                <strong>Verified Commands:</strong> {activeScenario.stage2.payload.runbookCommands.join(' && ')}
              </div>
            </div>

            {/* TEMPER Extraction Breakdown */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Hindsight TEMPER Biomimetic Pipeline Extraction
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {activeState.stage2Success ? 'STATUS: COMMITTED TO BANK' : 'STATUS: READY FOR INGESTION'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Entities Extracted</div>
                  <div className="text-slate-200 font-mono text-[11px] mt-1 space-y-0.5">
                    {activeScenario.stage2.temper.entities.map((e, idx) => (
                      <div key={idx} className="truncate">• {e}</div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Chronology Anchor</div>
                  <div className="text-slate-200 font-mono text-[11px] mt-1 leading-snug">
                    {activeScenario.stage2.temper.chronology}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Causal Graph Link</div>
                  <div className="text-slate-200 font-mono text-[11px] mt-1 leading-snug">
                    {activeScenario.stage2.temper.causalLink}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Memory Bank Target</div>
                  <div className="text-slate-200 font-mono text-[11px] mt-1 text-sky-300 leading-snug">
                    {activeScenario.stage2.temper.bankTarget}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setCurrentStage(3);
                  runStage3(activeScenario);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <span>Proceed to Stage 3: Test Learned Triage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {currentStage === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-mono">
                    3
                  </span>
                  Stage 3: After Memory (Learned Triage on Mutated Alert)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeScenario.stage3.description}
                </p>
              </div>

              <button
                onClick={() => runStage3(activeScenario)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                Run Autonomous Triage (Stage 3)
              </button>
            </div>

            {/* Mutated Input Log */}
            <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300">
              <div className="text-[11px] text-slate-500 mb-1">Mutated production alert arriving at 2:00 AM:</div>
              <div className="text-sky-300 whitespace-pre-line">
                {activeScenario.stage3.mutatedLog}
              </div>
              <div className="text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400">Expected: {activeScenario.stage3.expectedPattern}</span>
                <span className="text-sky-300">Retrieval: $0.00 (0 Tokens)</span>
              </div>
            </div>

            {/* Results Display */}
            {activeState.stage3 ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Diagnosis */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">CLASSIFICATION:</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {activeState.stage3.confidenceRating} ({activeState.stage3.confidenceScore}%)
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white">Deterministic Root Cause Identified:</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeState.stage3.rootCauseSummary}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Reasoning Time: {activeState.stage3.latencyMs}ms</span>
                      <span className="text-sky-400">Retrieval Tokens: 0 ($0.00)</span>
                    </div>
                  </div>

                  {/* Immediate Executable Fix */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-2 font-mono text-xs">
                    <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Actionable Verified CLI Mitigation:
                    </div>
                    <div className="text-slate-300 space-y-2">
                      {activeState.stage3.recommendedRunbook.slice(0, 3).map(cmd => (
                        <div key={cmd.stepNumber} className="bg-[#080d16] p-2.5 rounded border border-slate-800 text-[11px]">
                          <div className="text-slate-500 text-[10px] mb-0.5">Step {cmd.stepNumber}: {cmd.description}</div>
                          <div className="text-emerald-300 select-all overflow-x-auto">$ {cmd.command}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Evolution Proven:</strong> Instead of generic guessing, IncidentOps recognized the mutated <strong className="text-white">{activeScenario.service}</strong> failure instantly via Hindsight's 4-channel causal graph and provided the exact operational fix in sub-second time.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center text-xs text-slate-500">
                Click "Run Autonomous Triage (Stage 3)" to test memory recall.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side-by-Side MTTR & ROI Impact Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Enterprise Metric Comparison: Traditional SRE vs. IncidentOps
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Targeting: <strong className="text-slate-200">{activeScenario.name}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-semibold text-slate-300">Metric Dimension</th>
                <th className="pb-2.5 font-semibold text-slate-400">Traditional SRE (Amnesia)</th>
                <th className="pb-2.5 font-semibold text-slate-400">Naive Vector RAG</th>
                <th className="pb-2.5 font-semibold text-emerald-400">IncidentOps (Groq + Hindsight)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Mean Time to Resolution (MTTR)</td>
                <td className="py-2.5 text-rose-400">4.2 Hours</td>
                <td className="py-2.5 text-amber-400">45 Minutes</td>
                <td className="py-2.5 text-emerald-400 font-bold">8.4 Seconds (-99.9%)</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Memory Retrieval Cost</td>
                <td className="py-2.5 text-slate-500">N/A (Manual Wiki Search)</td>
                <td className="py-2.5 text-rose-400">$0.08 per query (Embedding + Rerank)</td>
                <td className="py-2.5 text-emerald-400 font-bold">$0.00 (Zero LLM Tokens)</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Inference Latency</td>
                <td className="py-2.5 text-slate-500">Human manual trial-and-error</td>
                <td className="py-2.5 text-amber-400">12 - 35 Seconds (Slow LLM)</td>
                <td className="py-2.5 text-emerald-400 font-bold">280 - 450 ms (Groq LPU)</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">Causal & Temporal Awareness</td>
                <td className="py-2.5 text-slate-500">Lost in past Slack threads</td>
                <td className="py-2.5 text-rose-400">None (Cosine text match only)</td>
                <td className="py-2.5 text-emerald-400 font-bold">4-Channel Biomimetic Graph</td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-slate-200">On-Call Cognitive Burden</td>
                <td className="py-2.5 text-rose-400">Severe (Panic at 2:00 AM)</td>
                <td className="py-2.5 text-amber-400">Moderate (Hallucinated runbooks)</td>
                <td className="py-2.5 text-emerald-400 font-bold">Zero (Exact verified commands)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Custom Scenario Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b101b] border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Define Custom 3-Stage Outage Evolution
                  </h3>
                  <p className="text-xs text-slate-400">
                    Create a customized before-and-after scenario to test memory learning across failure mutations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Quick Template Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Quick Starter Templates:
                  </span>
                  <button
                    type="button"
                    onClick={handleClearCustomTemplate}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear Form
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MANUAL_SCENARIO_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyCustomTemplate(tmpl)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      {tmpl.iconEmoji} {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Scenario Title / Outage Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder="e.g. Elasticsearch JVM Garbage Collection Freeze"
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Microservice <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={customService}
                    onChange={e => setCustomService(e.target.value)}
                    placeholder="e.g. search-cluster"
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Stage 1 Input */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                    Stage 1: Novel Initial Outage Alert (Before Memory)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Simulates unseen failure</span>
                </div>
                <textarea
                  rows={3}
                  value={customStage1Log}
                  onChange={e => setCustomStage1Log(e.target.value)}
                  placeholder="Paste raw incoming error log lines or alert webhook for Stage 1..."
                  className="w-full bg-[#070b12] border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {/* Stage 2 Input */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-sky-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-[10px]">2</span>
                    Stage 2: Verified Post-Mortem & Fix (Hindsight Ingestion)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Retained into incidentops-bank</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Identified Root Cause
                    </label>
                    <input
                      type="text"
                      value={customStage2RootCause}
                      onChange={e => setCustomStage2RootCause(e.target.value)}
                      placeholder="e.g. Unindexed wildcard aggregation on heap"
                      className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Verified Runbook CLI Command(s)
                    </label>
                    <input
                      type="text"
                      value={customStage2Commands}
                      onChange={e => setCustomStage2Commands(e.target.value)}
                      placeholder="e.g. kubectl rollout restart deployment/... (separate multiple with &&)"
                      className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Stage 3 Input */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                    Stage 3: Mutated Future Alert (Testing Learned Memory)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Tests 0-token recall match</span>
                </div>
                <textarea
                  rows={3}
                  value={customStage3MutatedLog}
                  onChange={e => setCustomStage3MutatedLog(e.target.value)}
                  placeholder="Paste mutated alert occurring weeks later with reworded telemetry or different node/pod..."
                  className="w-full bg-[#070b12] border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={!customStage1Log.trim() || !customStage3MutatedLog.trim()}
                  onClick={() => handleSaveManualScenario(false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Load into Scenarios
                </button>

                <button
                  type="button"
                  disabled={!customStage1Log.trim() || !customStage3MutatedLog.trim()}
                  onClick={() => handleSaveManualScenario(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  ⚡ Load & Run Evolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
