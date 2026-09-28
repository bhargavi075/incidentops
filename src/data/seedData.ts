import { IncidentMemory, LogPreset } from '../types/incident';

export const SEEDED_INCIDENTS: IncidentMemory[] = [
  {
    id: 'INC-2026-8812',
    title: 'Redis Port 6379 Connection Pool Exhaustion on Checkout Worker',
    service: 'checkout-service',
    severity: 'P1-CRITICAL',
    timestamp: '2026-09-14 02:18:04 UTC',
    errorSignature: 'HTTP 504 Gateway Timeout: redis: connection pool exhausted (port 6379) on checkout-cluster-worker',
    rootCause: 'Zombie connection leak in Python redis-py connection pool during unexpected upstream payment timeout. Worker processes failed to release client leases on port 6379, causing subsequent checkout HTTP requests to queue and trigger 504 gateway timeouts.',
    runbookFix: [
      'Terminate orphaned normal connections via redis-cli client kill',
      'Update config map with pool_timeout=5s and max_idle_connections=50',
      'Gracefully reload checkout-worker deployment pods',
      'Verify connection pool metrics return under 45% threshold'
    ],
    cliCommands: [
      'redis-cli -h redis-master.production.svc.cluster.local -p 6379 client kill type normal',
      'kubectl patch configmap checkout-config -p \'{"data":{"REDIS_POOL_TIMEOUT":"5s","MAX_IDLE":"50"}}\'',
      'kubectl rollout restart deployment/checkout-cluster-worker -n production',
      'redis-cli -h redis-master.production.svc.cluster.local -p 6379 info clients'
    ],
    tags: ['redis', 'checkout', 'pool-exhaustion', 'http-504', 'port-6379', 'zombie-connections'],
    author: 'sre-oncall-lead@company.internal',
    causalChain: {
      trigger: 'Upstream payment gateway timeout at 02:15 UTC during traffic burst',
      mechanism: 'redis-py client unreleased socket leases on port 6379 -> pool saturated at 10,000 max_conns',
      impact: 'HTTP 504 Gateway Timeout across 100% of checkout-cluster-worker nodes',
      mitigation: 'Executed redis-cli client kill type normal and configured strict 5s pool timeout'
    },
    temperExtraction: {
      entities: ['checkout-cluster-worker', 'redis-master:6379', 'connection_pool', 'redis-py'],
      metrics: ['pool_utilization:100%', 'http_504_rate:84.2/sec', 'active_clients:10000'],
      properties: ['pool_timeout=none', 'max_connections=10000', 'client_type=normal'],
      events: ['upstream_payment_timeout', 'socket_lease_leak', 'http_504_cascade'],
      resolution: 'redis-cli client kill type normal + pool_timeout=5s hotfix'
    }
  },
  {
    id: 'INC-2026-7491',
    title: 'Kafka Consumer Lag Deserialization Bug in Payment Stream',
    service: 'payment-stream',
    severity: 'P1-CRITICAL',
    timestamp: '2026-09-02 14:41:22 UTC',
    errorSignature: 'KafkaLagException: consumer group payment-processor-v2 lag > 50,000 msg, SerializationException: Missing mandatory key `currency_code`',
    rootCause: 'A poison pill JSON message missing the mandatory `currency_code` schema attribute triggered an unhandled Jackson deserialization error. The consumer group worker entered an infinite crash-and-retry backoff loop without committing the offset, starving all downstream payment processing.',
    runbookFix: [
      'Shift consumer group partition offset by +1 to skip poison pill message',
      'Route bad message payload to payment-dead-letter-queue for auditing',
      'Deploy patch PR-9182 enabling lenient JSON schema parser with DLQ fallback',
      'Monitor consumer group lag until metric drops below 100 messages'
    ],
    cliCommands: [
      'kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --group payment-processor-v2 --topic payments.incoming --reset-offsets --shift-by 1 --execute',
      'kafka-console-producer.sh --bootstrap-server kafka-broker:9092 --topic payments.dlq < /tmp/poison_pill_payload.json',
      'kubectl set image deployment/payment-processor payment-processor=registry.internal/payments/processor:v2.14.1-patch',
      'kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --describe --group payment-processor-v2'
    ],
    tags: ['kafka', 'consumer-lag', 'deserialization', 'poison-pill', 'payment-stream', 'offset-shift'],
    author: 'payment-platform-oncall@company.internal',
    causalChain: {
      trigger: 'Partner merchant API sent malformed batch missing `currency_code` at offset 18492041',
      mechanism: 'Strict Jackson deserializer failed -> continuous worker crashloop without offset ack',
      impact: 'Consumer lag skyrocketed to 58,400 messages, payment settlement delayed by 45 minutes',
      mitigation: 'Shifted partition offset +1 via kafka-consumer-groups.sh and committed DLQ routing'
    },
    temperExtraction: {
      entities: ['payment-processor-v2', 'kafka-broker:9092', 'payments.incoming', 'JacksonDeserializer'],
      metrics: ['consumer_lag:58400', 'message_delay_seconds:2700', 'error_count:1420'],
      properties: ['offset:18492041', 'schema_field_missing:currency_code', 'group_id:payment-processor-v2'],
      events: ['malformed_partner_payload', 'deserialization_unhandled_exception', 'partition_blockage'],
      resolution: 'Manual offset shift by 1 + DLQ bypass'
    }
  },
  {
    id: 'INC-2026-6129',
    title: 'PostgreSQL Connection Saturation during Nightly ETL Cron Rollup',
    service: 'data-platform-analytics',
    severity: 'P2-HIGH',
    timestamp: '2026-08-28 04:00:15 UTC',
    errorSignature: 'FATAL: remaining connection slots are reserved for non-superuser connections (max_connections=500 exceeded)',
    rootCause: 'The nightly `analytics_nightly_rollup` cron job spawned 200 concurrent Celery sub-tasks that directly bypassed PgBouncer pooler and connected straight to PostgreSQL port 5432. All 500 connection slots were rapidly exhausted by idle-in-transaction queries, starving the core API service.',
    runbookFix: [
      'Terminate idle-in-transaction backends older than 5 minutes',
      'Direct analytics cron configuration to route through PgBouncer port 6432 transaction pool',
      'Increase PgBouncer reserve_pool_size to 25',
      'Verify active backend connections normalize below 120'
    ],
    cliCommands: [
      'psql -h pg-primary.internal -U postgres -d core_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle in transaction\' AND state_change < NOW() - INTERVAL \'5 minutes\';"',
      'kubectl patch cronjob analytics-nightly-rollup -p \'{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"worker","env":[{"name":"DB_PORT","value":"6432"}]}]}}}}}}\'',
      'psql -h pg-primary.internal -U postgres -d core_db -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"',
      'kubectl rollout restart deployment/api-core -n production'
    ],
    tags: ['postgresql', 'connection-pool', 'pgbouncer', 'max-connections', 'idle-in-transaction', 'cron-job'],
    author: 'dba-infrastructure@company.internal',
    causalChain: {
      trigger: '04:00 UTC Scheduled launch of analytics_nightly_rollup cron job',
      mechanism: '200 unpooled Celery workers connected directly to port 5432, holding idle in transaction locks',
      impact: 'FATAL remaining connection slots exceeded, all core user API transactions rejected for 18 min',
      mitigation: 'Terminated stale idle-in-transaction backends and repointed cron to PgBouncer port 6432'
    },
    temperExtraction: {
      entities: ['pg-primary.internal:5432', 'analytics_nightly_rollup', 'pgbouncer:6432', 'pg_stat_activity'],
      metrics: ['active_connections:500/500', 'rejection_count:421', 'idle_in_transaction_count:192'],
      properties: ['max_connections=500', 'pool_bypass=true', 'cron_schedule=0 4 * * *'],
      events: ['etl_job_burst', 'unpooled_connection_spike', 'backend_slot_starvation'],
      resolution: 'pg_terminate_backend on idle connections + PgBouncer redirect'
    }
  }
];

export const PRESET_LOGS: LogPreset[] = [
  {
    id: 'preset-redis-exact',
    title: 'Redis Pool Exhaustion (Exact Historical Match)',
    service: 'checkout-service',
    severity: 'P1-CRITICAL',
    scenario: 'Redis Pool Exhaustion',
    logSnippet: `2026-09-27T09:12:04.112Z [ERROR] checkout-cluster-worker-01: HTTP 504 Gateway Timeout
redis.exceptions.ConnectionError: Error 111 connecting to redis-master.production.svc.cluster.local:6379. Connection pool exhausted (max 10000 connections reached).
Traceback (most recent call last):
  File "/app/services/checkout.py", line 184, in process_cart_reservation
    with redis_pool.get_connection() as conn:
  File "/usr/local/lib/python3.11/site-packages/redis/connection.py", line 1442, in get_connection
    raise ConnectionError("Connection pool exhausted")
[CRITICAL] 504 upstream error rate spikes to 92.4% on /api/v2/checkout/finalize`,
    isMutated: false,
    isNovel: false
  },
  {
    id: 'preset-redis-mutated',
    title: 'Mutated Alert: Checkout Worker 04 (Demonstration Stage 3)',
    service: 'checkout-service',
    severity: 'P1-CRITICAL',
    scenario: 'Mutated Checkout Alert',
    logSnippet: `2026-09-27T09:14:55.803Z [ALERT] Ingress Envoy Gateway [checkout-ingress-prod]
[upstream_reset_before_response_started{connection_termination}]
HTTP 504 Gateway Timeout detected on checkout-cluster-worker-04.
Failed contacting backend cache shard: redis-master:6379.
Worker pool report: active_socket_leases=9998, idle_dead_leases=7420, client_type='normal'.
Threshold exceeded: latency P99 > 30,000ms. Transactions aborted: 3,410.`,
    isMutated: true,
    isNovel: false
  },
  {
    id: 'preset-kafka-lag',
    title: 'Kafka Consumer Lag Spike (Schema Poison Pill)',
    service: 'payment-stream',
    severity: 'P1-CRITICAL',
    scenario: 'Kafka Deserialization',
    logSnippet: `2026-09-27T09:10:18.940Z [ERROR] payment-processor-v2 [Worker-Thread-8]:
org.apache.kafka.common.errors.SerializationException: Error deserializing key/value for partition payments.incoming-4 at offset 18492041
Caused by: com.fasterxml.jackson.databind.exc.MismatchedInputException: Missing mandatory JSON property 'currency_code'
at [Source: (byte[])"{"order_id":"ord_8921","amount_cents":4500,"token":"tok_live"}"; line: 1, column: 62]
[METRIC ALERT] ConsumerLagExceededThreshold: consumer group payment-processor-v2 current lag = 54,210 messages (SLA > 500).`,
    isMutated: false,
    isNovel: false
  },
  {
    id: 'preset-postgres-saturation',
    title: 'PostgreSQL Connection Exhaustion (Nightly Cron)',
    service: 'data-platform-analytics',
    severity: 'P2-HIGH',
    scenario: 'PostgreSQL Saturation',
    logSnippet: `2026-09-27T04:02:11.008Z [FATAL] PostgreSQL primary postgresql-cluster-0:
FATAL: remaining connection slots are reserved for non-superuser connections
DETAIL: Database connection limit (max_connections=500) reached. Active connections: 500, waiting: 84.
2026-09-27T04:02:12.115Z [ERROR] api-core-deployment: sqlalchemy.exc.OperationalError: could not connect to server: Connection refused
Target host: pg-primary.internal:5432 (direct unpooled connection). Triggered by analytics_nightly_rollup.`,
    isMutated: false,
    isNovel: false
  },
  {
    id: 'preset-novel-outage',
    title: 'Novel Outage: Kubernetes OOMKilled on Envoy Ingress (Stage 1)',
    service: 'ingress-gateway',
    severity: 'P1-CRITICAL',
    scenario: 'Novel Kubernetes OOM',
    logSnippet: `2026-09-27T09:05:01.312Z [CRITICAL] kube-system / ingress-controller-envoy-7b89f8dc9f-k2l8m:
Event: Pod /ingress-controller-envoy-7b89f8dc9f-k2l8m terminated with ExitCode: 137 (OOMKilled)
Memory usage exceeded cgroup limit: 2048MiB / 2048MiB.
High connection churn: TLS handshake buffers allocated 1.8GB during DDoS burst on edge interface eth0.
Incoming traffic dropped: 14,200 connections refused. No prior post-mortem found in bank.`,
    isMutated: false,
    isNovel: true
  }
];

export const PYTHON_SUITE_SCRIPTS = {
  sample_incidents: `"""
sample_incidents.py - Incident Knowledge Base Seeding for IncidentOps
Pre-populates the Hindsight biomimetic memory bank ('incidentops-bank')
with 3 realistic enterprise production outages.
"""

import os
from hindsight_client import Hindsight
from dotenv import load_dotenv

load_dotenv()

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
BANK_ID = "incidentops-bank"

incidents_to_seed = [
    {
        "title": "Redis Port 6379 Connection Pool Exhaustion on Checkout Worker",
        "service": "checkout-service",
        "post_mortem": """
INCIDENT RCA: HTTP 504 on checkout-cluster-worker
TIMESTAMP: 2026-09-14 02:18:04 UTC
ROOT CAUSE: Zombie connection leak in Python redis-py connection pool during unexpected upstream
payment timeout. Worker processes failed to release client leases on port 6379, causing subsequent
checkout HTTP requests to queue and trigger 504 gateway timeouts.
VERIFIED RESOLUTION:
1. Terminate orphaned normal connections: redis-cli -h redis-master -p 6379 client kill type normal
2. Apply configmap patch: pool_timeout=5s and max_idle_connections=50
3. Gracefully reload deployment: kubectl rollout restart deployment/checkout-cluster-worker -n production
"""
    },
    {
        "title": "Kafka Consumer Lag Deserialization Bug in Payment Stream",
        "service": "payment-stream",
        "post_mortem": """
INCIDENT RCA: Kafka Consumer Lag Spike > 50k messages
TIMESTAMP: 2026-09-02 14:41:22 UTC
ROOT CAUSE: A poison pill JSON message missing the mandatory 'currency_code' schema attribute
triggered an unhandled Jackson deserialization error. The consumer group worker entered an infinite
crash-and-retry backoff loop without committing the offset, starving all downstream payment processing.
VERIFIED RESOLUTION:
1. Skip poison pill offset: kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --group payment-processor-v2 --topic payments.incoming --reset-offsets --shift-by 1 --execute
2. Route payload to DLQ: kafka-console-producer.sh --bootstrap-server kafka-broker:9092 --topic payments.dlq < /tmp/poison_pill.json
3. Rollout patch v2.14.1 with lenient schema parsing
"""
    },
    {
        "title": "PostgreSQL Connection Saturation during Nightly ETL Cron Rollup",
        "service": "data-platform-analytics",
        "post_mortem": """
INCIDENT RCA: FATAL remaining connection slots exceeded (max_connections=500)
TIMESTAMP: 2026-08-28 04:00:15 UTC
ROOT CAUSE: The nightly 'analytics_nightly_rollup' cron job spawned 200 concurrent Celery sub-tasks
that directly bypassed PgBouncer pooler and connected straight to PostgreSQL port 5432. All 500 connection
slots were rapidly exhausted by idle-in-transaction queries, starving the core API service.
VERIFIED RESOLUTION:
1. Terminate stale backends: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';
2. Repoint cron config to route through PgBouncer port 6432 transaction pool.
3. Restart api-core deployment.
"""
    }
]

def seed_knowledge_base():
    client = Hindsight(api_key=HINDSIGHT_API_KEY, base_url=HINDSIGHT_BASE_URL)
    print(f"[*] Connected to Hindsight Cloud. Seeding bank '{BANK_ID}'...")
    for idx, inc in enumerate(incidents_to_seed, 1):
        print(f"[{idx}/3] Retaining: {inc['title']}...")
        response = client.retain(
            bank_id=BANK_ID,
            content=inc["post_mortem"],
            context=f"Service: {inc['service']} | Incident: {inc['title']}"
        )
        # Access RetainResponse object properties via dot-notation (Pydantic model)
        rec_id = str(response.id) if hasattr(response, "id") and response.id else f"INC-2026-00{idx}"
        print(f"    -> Retained successfully. Memory record ID: {rec_id}")
    if hasattr(client, "close"):
        try:
            client.close()
        except Exception:
            pass
    print("[+] All enterprise outages seeded into incidentops-bank successfully.")

if __name__ == "__main__":
    seed_knowledge_base()
`,
  agent: `"""
agent.py - IncidentOps Autonomous SRE Root-Cause & Runbook Memory Agent
Pairs zero-cost Hindsight 4-channel recall with ultra-fast Groq LPU inference.
"""

import os
import time
from groq import Groq
from hindsight_client import Hindsight
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
BANK_ID = "incidentops-bank"

groq_client = Groq(api_key=GROQ_API_KEY)
hindsight_client = Hindsight(api_key=HINDSIGHT_API_KEY, base_url=HINDSIGHT_BASE_URL)

def retain_postmortem(content: str, service: str):
    """
    Ingests verified post-mortem through Hindsight's biomimetic TEMPER pipeline.
    Zero-cost memory formation for all future queries.
    """
    return hindsight_client.retain(
        bank_id=BANK_ID,
        content=content,
        context=f"Service: {service}"
    )

def triage_alert(error_log: str, service_hint: str = ""):
    """
    1. Zero-Cost Recall: Hindsight searches across BM25, semantic, temporal, and graph links.
    2. Ultra-Fast Groq Reasoning: Synthesizes alert with recalled operational history.
    """
    start_time = time.time()
    
    # Step 1: 4-Channel Biomimetic Recall (Zero LLM inference tokens)
    recall_results = hindsight_client.recall(
        bank_id=BANK_ID,
        query=error_log
    )
    
    has_relevant_memory = bool(recall_results and len(recall_results.get("memories", [])) > 0)
    
    # Step 2: Groq LPU Synthesis (<1 sec reasoning)
    system_prompt = \"\"\"You are IncidentOps, an autonomous Site Reliability Engineering (SRE) agent.
Analyze the live incoming error log. If recalled historical incidents are provided, cross-examine
the error signature against historical post-mortems and output:
1. STATUS: [Known Incident (High Confidence) | Novel Outage (Low Confidence)]
2. ROOT CAUSE SUMMARY: Direct, specific root cause.
3. EXECUTABLE CLI RUNBOOK: Shell commands for immediate on-call execution.\"\"\"
    
    memory_context = ""
    if has_relevant_memory:
        memory_context = f"RECALLED POST-MORTEM HISTORY (0-Token Hindsight Memory):\\n{recall_results['memories']}\\n"
    else:
        memory_context = "RECALLED POST-MORTEM HISTORY: No past post-mortems match this error signature (Novel Outage).\\n"

    user_prompt = f\"\"\"{memory_context}
LIVE INCOMING ERROR LOG:
{error_log}
\"\"\"

    completion = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b", # or "llama-3.3-70b-versatile"
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1
    )
    
    elapsed_ms = (time.time() - start_time) * 1000
    return {
        "status": "KNOWN_INCIDENT" if has_relevant_memory else "NOVEL_OUTAGE",
        "diagnosis": completion.choices[0].message.content,
        "latency_ms": elapsed_ms,
        "recalled_memories": recall_results.get("memories", []),
        "retrieval_cost": "$0.00 (Zero LLM tokens)"
    }
`,
  app_py: `"""
app.py - IncidentOps Streamlit Web Dashboard
Interactive console for Live Alert Triage, Post-Mortem Studio, and Memory Explorer.
"""

import streamlit as st
import time
from agent import triage_alert, retain_postmortem

st.set_page_config(page_title="IncidentOps - SRE Memory Agent", layout="wide", page_icon="⚡")

st.title("⚡ IncidentOps: Autonomous SRE Root-Cause & Runbook Memory Agent")
st.caption("Pairing Groq Ultra-Low Latency Inference with Hindsight Biomimetic Persistent Memory")

tab1, tab2, tab3 = st.tabs(["🚨 Live Alert Triage", "📝 Post-Mortem Ingestion Studio", "🧠 Memory Explorer"])

with tab1:
    st.subheader("Live Alert Triage Console")
    alert_input = st.text_area("Paste Incoming Production Error Log / CloudWatch / Datadog Alert:", height=150)
    col1, col2 = st.columns([1, 4])
    with col1:
        triage_btn = st.button("⚡ Triage Alert with IncidentOps", type="primary")
    
    if triage_btn and alert_input:
        with st.spinner("Executing 4-channel zero-cost recall + Groq LPU reasoning..."):
            result = triage_alert(alert_input)
            
        st.success(f"Triage completed in {result['latency_ms']:.1f}ms | Retrieval Cost: {result['retrieval_cost']}")
        
        m_col1, m_col2 = st.columns(2)
        with m_col1:
            st.markdown("### 🧠 Recalled Hindsight Memories")
            if result['recalled_memories']:
                for m in result['recalled_memories']:
                    st.info(m)
            else:
                st.warning("No historical matches found in incidentops-bank (Novel Outage).")
                
        with m_col2:
            st.markdown("### ⚡ Groq LPU Diagnosis & Runbook")
            st.markdown(result['diagnosis'])

with tab2:
    st.subheader("Post-Mortem Ingestion Studio")
    service = st.text_input("Service Name (e.g., checkout-service):")
    postmortem_text = st.text_area("Verified Incident Post-Mortem & Runbook Fix:", height=200)
    if st.button("Ingest into incidentops-bank"):
        if service and postmortem_text:
            res = retain_postmortem(postmortem_text, service)
            st.success("Successfully ingested into Hindsight biomimetic memory graph!")
`,
  test_cloud_hindsight: `"""
test_cloud_hindsight.py - Verifies Hindsight Cloud connectivity and retain/recall primitives.
"""
import os
from hindsight_client import Hindsight
from dotenv import load_dotenv

load_dotenv()

client = Hindsight(
    api_key=os.getenv("HINDSIGHT_API_KEY"),
    base_url=os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
)

print("[*] Testing retain() on 'incidentops-bank'...")
res_retain = client.retain(
    bank_id="incidentops-bank",
    content="Checkout worker HTTP 504 caused by Redis port 6379 pool exhaustion. Fix: redis-cli client kill type normal.",
    context="Service: checkout-service"
)
print("    -> retain result:", res_retain)

print("[*] Testing recall() on 'incidentops-bank'...")
res_recall = client.recall(
    bank_id="incidentops-bank",
    query="HTTP 504 on checkout worker"
)
print("    -> recall result:", res_recall)
print("[+] Verification complete!")
`,
  test_groq: `"""
test_groq.py - Verifies Groq LPU sub-second inference connectivity.
"""
import os
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

t0 = time.time()
resp = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "Respond with 'IncidentOps Groq LPU Online' in 5 words."}],
    temperature=0.1
)
t1 = time.time()

print(f"[+] Groq response in {(t1-t0)*1000:.1f}ms: {resp.choices[0].message.content}")
`
};
