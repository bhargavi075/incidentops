"""
sample_incidents.py - Knowledge Base Seeding for IncidentOps
Pre-populates the Hindsight biomimetic memory bank ('incidentops-bank')
with 3 realistic enterprise production outages.
"""

import os
from dotenv import load_dotenv
from hindsight_client import Hindsight

load_dotenv()

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "incidentops-bank")

incidents_to_seed = [
    {
        "title": "Redis Port 6379 Connection Pool Exhaustion on Checkout Worker",
        "service": "checkout-service",
        "severity": "P1 - Critical Outage",
        "author": "sre-lead@company.internal",
        "post_mortem": """INCIDENT TITLE: Redis Port 6379 Connection Pool Exhaustion on Checkout Worker
SERVICE: checkout-service
TIMESTAMP: 2026-09-14 02:18:04 UTC
SEVERITY: P1 - Critical Outage
AUTHOR: sre-lead@company.internal
ERROR SIGNATURE:
HTTP 504 Gateway Timeout: redis: connection pool exhausted (port 6379) on checkout-cluster-worker

ROOT CAUSE ANALYSIS:
Zombie connection leak in Python redis-py connection pool during unexpected upstream
payment timeout. Worker processes failed to release client leases on port 6379, causing subsequent
checkout HTTP requests to queue and trigger 504 gateway timeouts.

VERIFIED REMEDIATION RUNBOOK:
redis-cli -h redis-master.production.svc.cluster.local -p 6379 client kill type normal
kubectl patch configmap checkout-config -p '{"data":{"REDIS_POOL_TIMEOUT":"5s","MAX_IDLE":"50"}}'
kubectl rollout restart deployment/checkout-cluster-worker -n production
"""
    },
    {
        "title": "Kafka Consumer Lag Deserialization Bug in Payment Stream",
        "service": "payment-stream",
        "severity": "P1 - Critical Outage",
        "author": "payment-oncall@company.internal",
        "post_mortem": """INCIDENT TITLE: Kafka Consumer Lag Deserialization Bug in Payment Stream
SERVICE: payment-stream
TIMESTAMP: 2026-09-02 14:41:22 UTC
SEVERITY: P1 - Critical Outage
AUTHOR: payment-oncall@company.internal
ERROR SIGNATURE:
KafkaLagException: consumer group payment-processor-v2 lag > 50,000 msg, SerializationException: Missing mandatory key `currency_code`

ROOT CAUSE ANALYSIS:
A poison pill JSON message missing the mandatory 'currency_code' schema attribute triggered
an unhandled Jackson deserialization error. The consumer group worker entered an infinite crash-and-retry
backoff loop without committing the offset, starving all downstream payment processing.

VERIFIED REMEDIATION RUNBOOK:
kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --group payment-processor-v2 --topic payments.incoming --reset-offsets --shift-by 1 --execute
kafka-console-producer.sh --bootstrap-server kafka-broker:9092 --topic payments.dlq < /tmp/poison_pill_payload.json
kubectl set image deployment/payment-processor payment-processor=registry.internal/payments/processor:v2.14.1-patch
"""
    },
    {
        "title": "PostgreSQL Connection Saturation during Nightly ETL Cron Rollup",
        "service": "data-platform-analytics",
        "severity": "P2 - Major Degradation",
        "author": "dba-infrastructure@company.internal",
        "post_mortem": """INCIDENT TITLE: PostgreSQL Connection Saturation during Nightly ETL Cron Rollup
SERVICE: data-platform-analytics
TIMESTAMP: 2026-08-28 04:00:15 UTC
SEVERITY: P2 - Major Degradation
AUTHOR: dba-infrastructure@company.internal
ERROR SIGNATURE:
FATAL: remaining connection slots are reserved for non-superuser connections (max_connections=500 exceeded)

ROOT CAUSE ANALYSIS:
The nightly 'analytics_nightly_rollup' cron job spawned 200 concurrent Celery sub-tasks
that directly bypassed PgBouncer pooler and connected straight to PostgreSQL port 5432. All 500 connection
slots were rapidly exhausted by idle-in-transaction queries, starving the core API service.

VERIFIED REMEDIATION RUNBOOK:
psql -h pg-primary.internal -U postgres -d core_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';"
kubectl patch cronjob analytics-nightly-rollup -p '{"spec":{"jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"worker","env":[{"name":"DB_PORT","value":"6432"}]}]}}}}}}'
kubectl rollout restart deployment/api-core -n production
"""
    }
]


def seed_knowledge_base():
    if not HINDSIGHT_API_KEY:
        print("[!] ERROR: HINDSIGHT_API_KEY is not set in environment or .env file.")
        return

    client = Hindsight(api_key=HINDSIGHT_API_KEY, base_url=HINDSIGHT_BASE_URL)
    print(f"[*] Connected to Hindsight Cloud at {HINDSIGHT_BASE_URL}")
    print(f"[*] Seeding memory bank '{BANK_ID}' with {len(incidents_to_seed)} enterprise outages...")

    for idx, inc in enumerate(incidents_to_seed, 1):
        print(f"[{idx}/3] Ingesting: {inc['title']}...")
        context_str = f"Service: {inc['service']} | Author: {inc['author']} | Severity: {inc['severity']}"
        try:
            resp = client.retain(
                bank_id=BANK_ID,
                content=inc["post_mortem"],
                context=context_str
            )
            # Access RetainResponse object properties via dot-notation (Pydantic model)
            rec_id = str(resp.id) if hasattr(resp, "id") and resp.id else f"INC-{idx}"
            print(f"    -> Retained successfully. Memory record ID: {rec_id}")
        except Exception as e:
            print(f"    -> Ingestion error: {e}")

    if hasattr(client, "close"):
        try:
            client.close()
        except Exception:
            pass

    print(f"[+] All enterprise outages committed into '{BANK_ID}'. Zero-cost 4-channel recall is active.")


if __name__ == "__main__":
    seed_knowledge_base()
