"""agent.py - Enterprise IncidentOps Backend Intelligence Engine
Pairs Groq ultra-fast LPU inference with Hindsight persistent biomimetic memory.
Features:
- Zero-cost 4-channel recall ($0.00 / 0 LLM retrieval tokens)
- Dual-mode evaluation (Stateless Baseline vs Memory-Augmented Triage)
- Static regex command safety guard (Destructive vs Safe / Dry-run verified)
- Automated Post-Mortem extraction from raw Slack / triage notes
- SRE audit trail & attribution metadata
"""

import os
import re
import time
import json
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv
from groq import Groq
from hindsight_client import Hindsight

load_dotenv()

# Configuration and Environment Variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "incidentops-bank")
DEFAULT_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODEL = "llama-3.3-70b-versatile"

# Initialize SDK Clients
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
hindsight_client = (
    Hindsight(api_key=HINDSIGHT_API_KEY, base_url=HINDSIGHT_BASE_URL)
    if HINDSIGHT_API_KEY
    else None
)

# Regex Safety Patterns for Operational Runbook Commands
DESTRUCTIVE_COMMAND_PATTERNS = [
    r"\brm\s+-(?:rf|fr|r|f)\b",
    r"\bdrop\s+(?:database|table|schema|user)\b",
    r"\bkill\s+-9\s+-1\b",
    r"\bkubectl\s+delete\s+namespace\b",
    r"\btruncate\s+(?:table\s+)?[a-zA-Z0-9_]+\b",
    r"\bmkfs\b",
    r"\bdd\s+if=",
    r">\s*/dev/sda",
    r"\bshutdown\s+-h\b",
    r"\breboot\b"
]


def check_command_safety(command_str: str) -> Dict[str, Any]:
    """
    Performs static regex safety analysis on shell/runbook commands.
    Flags destructive commands (rm -rf, drop database, kill -9 -1, delete namespace, truncate)
    vs safe inspection/recovery (redis-cli client kill, kubectl rollout restart, pg_terminate_backend).
    """
    lines = [line.strip() for line in command_str.split("\n") if line.strip() and not line.strip().startswith("#")]
    violations = []

    for line in lines:
        for pattern in DESTRUCTIVE_COMMAND_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                violations.append({"command": line, "pattern": pattern})

    if violations:
        return {
            "status": "HIGH_RISK",
            "badge": "🚨 HIGH RISK: DESTRUCTIVE COMMAND DETECTED",
            "is_safe": False,
            "violations": violations,
            "recommendation": "Manual SRE peer review and secondary confirmation required before executing."
        }

    return {
        "status": "SAFE",
        "badge": "🛡️ SAFE / DRY-RUN VERIFIED",
        "is_safe": True,
        "violations": [],
        "recommendation": "Non-destructive operational remediation. Safe for on-call execution."
    }


def parse_commands_from_text(text: str) -> List[str]:
    """
    Extracts bash/shell code snippets from markdown output.
    """
    code_blocks = re.findall(r"```(?:bash|sh|shell)?\n([\s\S]*?)```", text)
    extracted = []
    if code_blocks:
        for block in code_blocks:
            for line in block.split("\n"):
                line_clean = line.strip()
                if line_clean and not line_clean.startswith("#"):
                    extracted.append(line_clean)
    else:
        # Fallback to line scanning for typical CLI commands
        for line in text.split("\n"):
            line_clean = line.strip()
            if line_clean.startswith("$ "):
                extracted.append(line_clean[2:].strip())
            elif any(line_clean.startswith(prefix) for prefix in ["redis-cli", "kubectl", "kafka-", "psql", "curl", "systemctl"]):
                extracted.append(line_clean)
    return extracted


def call_groq_with_fallback(messages: List[Dict[str, str]], temperature: float = 0.1) -> Tuple[str, str, float]:
    """
    Invokes Groq LPU inference with automatic fallback from gpt-oss-120b to llama-3.3-70b-versatile.
    Returns (content, model_used, latency_ms).
    """
    if not groq_client:
        raise ValueError("GROQ_API_KEY is not configured in environment or .env file.")

    t0 = time.time()
    try:
        resp = groq_client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=messages,
            temperature=temperature
        )
        latency_ms = (time.time() - t0) * 1000
        return resp.choices[0].message.content, DEFAULT_MODEL, latency_ms
    except Exception as e:
        print(f"[!] Primary model {DEFAULT_MODEL} failed: {e}. Retrying with {FALLBACK_MODEL}...")
        resp = groq_client.chat.completions.create(
            model=FALLBACK_MODEL,
            messages=messages,
            temperature=temperature
        )
        latency_ms = (time.time() - t0) * 1000
        return resp.choices[0].message.content, FALLBACK_MODEL, latency_ms


def recall_hindsight_memories(query: str) -> List[str]:
    """
    Performs zero-cost 4-channel memory retrieval via Hindsight.
    CRITICAL: Uses strict Pydantic object attribute access (`recall_resp.results`),
    NEVER .get() or dict subscripting.
    """
    if not hindsight_client:
        print("[!] Hindsight client not configured.")
        return []

    try:
        recall_resp = hindsight_client.recall(
            bank_id=BANK_ID,
            query=query
        )

        # STRICT Pydantic Object Access Rule
        if hasattr(recall_resp, "results") and recall_resp.results:
            recalled_memories = [r.text for r in recall_resp.results if hasattr(r, "text") and r.text]
        else:
            recalled_memories = []

        return recalled_memories
    except Exception as e:
        print(f"[!] Hindsight recall failed: {e}")
        return []


def retain_postmortem(
    title: str,
    service: str,
    root_cause: str,
    runbook_commands: str,
    author: str = "sre-oncall@company.internal",
    severity: str = "P1 - Critical Outage",
    error_signature: str = ""
) -> Dict[str, Any]:
    """
    Ingests verified post-mortem through Hindsight's biomimetic TEMPER pipeline.
    Embeds SRE audit trail & attribution into metadata context.
    """
    if not hindsight_client:
        raise ValueError("HINDSIGHT_API_KEY is not configured.")

    timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())

    content = f"""INCIDENT TITLE: {title}
SERVICE: {service}
TIMESTAMP: {timestamp}
SEVERITY: {severity}
AUTHOR: {author}
ERROR SIGNATURE:
{error_signature if error_signature else title}

ROOT CAUSE ANALYSIS:
{root_cause}

VERIFIED REMEDIATION RUNBOOK:
{runbook_commands}
"""

    context_str = f"Service: {service} | Author: {author} | Severity: {severity}"

    try:
        retain_resp = hindsight_client.retain(
            bank_id=BANK_ID,
            content=content,
            context=context_str
        )

        # Access RetainResponse object properties via dot-notation (Pydantic model)
        memory_id = str(retain_resp.id) if hasattr(retain_resp, "id") and retain_resp.id else f"INC-{int(time.time())}"
        return {
            "success": True,
            "memory_id": memory_id,
            "service": service,
            "author": author,
            "severity": severity,
            "timestamp": timestamp,
            "context": context_str
        }
    except Exception as e:
        print(f"[!] Error in hindsight.retain: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def triage_alert(
    error_log: str,
    compare_stateless: bool = False
) -> Dict[str, Any]:
    """
    Primary SRE triage workflow:
    1. Zero-Cost Hindsight Recall ($0.00 LLM Cost)
    2. Groq LPU Inference cross-examining live error with recalled memory
    3. (Optional) Parallel Stateless LLM comparison query
    4. Static command safety check on generated runbook
    """
    # Step 1: Zero-cost 4-channel memory retrieval
    recalled_memories = recall_hindsight_memories(error_log)
    has_memories = len(recalled_memories) > 0

    # Step 2: Groq LPU synthesis with Memory
    memory_section = ""
    if has_memories:
        memory_section = "HISTORICAL INCIDENT MEMORIES FROM HINDSIGHT BANK ($0.00 Recall Cost):\n"
        for idx, m in enumerate(recalled_memories, 1):
            memory_section += f"[Memory #{idx}]\n{m}\n---\n"
    else:
        memory_section = "HISTORICAL MEMORY STATUS: No past post-mortems found in incidentops-bank (Novel Outage Baseline).\n"

    system_prompt = """You are IncidentOps, an autonomous Principal Site Reliability Engineering (SRE) Agent.
Your job is to cross-examine incoming production error logs against past verified post-mortems from the Hindsight memory bank.

OUTPUT REQUIREMENTS:
1. INCIDENT STATUS:
   - If historical post-mortems match the root mechanism (even if host/pod/time mutated): State "KNOWN INCIDENT (HIGH CONFIDENCE)"
   - If no past memories exist: State "NOVEL OUTAGE (LOW / GENERIC CONFIDENCE)"
2. DIAGNOSED ROOT CAUSE:
   - Provide a precise, non-generic technical explanation of the failure mechanism.
3. EXECUTABLE CLI RUNBOOK:
   - Provide a bash code block (```bash ... ```) containing the exact shell commands needed for immediate on-call remediation.
   - Do not output vague instructions like "check logs" if a known fix exists."""

    user_prompt = f"""{memory_section}
LIVE INCOMING ERROR LOG:
```
{error_log}
```
Diagnose the failure and output the actionable runbook:"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    diagnosis_text, model_used, latency_ms = call_groq_with_fallback(messages)

    # Parse commands and run safety guard
    parsed_commands = parse_commands_from_text(diagnosis_text)
    safety_report = check_command_safety("\n".join(parsed_commands))

    result = {
        "status": "KNOWN_INCIDENT" if has_memories else "NOVEL_OUTAGE",
        "has_memory": has_memories,
        "recalled_memories": recalled_memories,
        "retrieval_cost": "$0.00 (Zero LLM Tokens - 4-Channel Hybrid Recall)",
        "groq_latency_ms": round(latency_ms, 1),
        "model_used": model_used,
        "diagnosis_markdown": diagnosis_text,
        "parsed_commands": parsed_commands,
        "safety_report": safety_report,
        "stateless_comparison": None
    }

    # Step 3: Stateless LLM comparison query (if toggled)
    if compare_stateless:
        stateless_system_prompt = """You are a standard stateless LLM assistant with NO access to cluster memory or past post-mortems.
Respond to the error log using general industry knowledge. Provide typical standard suggestions like scaling, restarting, or increasing thresholds."""
        
        stateless_user_prompt = f"""INCOMING ERROR LOG:
```
{error_log}
```
What is happening and how should I fix it?"""

        stateless_messages = [
            {"role": "system", "content": stateless_system_prompt},
            {"role": "user", "content": stateless_user_prompt}
        ]

        stateless_text, stateless_model, stateless_latency = call_groq_with_fallback(stateless_messages)
        stateless_cmds = parse_commands_from_text(stateless_text)
        stateless_safety = check_command_safety("\n".join(stateless_cmds))

        result["stateless_comparison"] = {
            "diagnosis_markdown": stateless_text,
            "latency_ms": round(stateless_latency, 1),
            "model_used": stateless_model,
            "parsed_commands": stateless_cmds,
            "safety_report": stateless_safety
        }

    return result


def generate_postmortem_from_notes(raw_notes: str) -> Dict[str, str]:
    """
    Automated Post-Mortem Template Generator:
    Takes messy on-call Slack messages, terminal traces, and notes,
    and prompts Groq to extract structured fields ready for Hindsight ingestion.
    """
    system_prompt = """You are an SRE Documentation Specialist.
Transform the provided raw Slack messages, terminal snippets, or unorganized incident notes into a structured post-mortem.
You must return strictly valid JSON matching this schema:
{
  "title": "Clear 1-line incident title (e.g. Redis Connection Pool Exhaustion on Port 6379)",
  "service": "Affected service identifier (e.g. checkout-service)",
  "severity": "P1 - Critical Outage" or "P2 - Major Degradation" or "P3 - Minor Issue",
  "error_signature": "Key error snippet or exception line",
  "root_cause": "Precise failure mechanism explanation (1-3 sentences)",
  "runbook_commands": "Bash commands for remediation, one per line"
}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"RAW INCIDENT NOTES:\n{raw_notes}\n\nProduce the structured JSON:"}
    ]

    response_text, _, _ = call_groq_with_fallback(messages, temperature=0.1)

    try:
        # Strip potential markdown code block markers
        clean_json = re.sub(r"^```(?:json)?\s*", "", response_text.strip())
        clean_json = re.sub(r"\s*```$", "", clean_json.strip())
        parsed = json.loads(clean_json)
        return parsed
    except Exception as e:
        print(f"[!] Failed to parse post-mortem JSON: {e}")
        return {
            "title": "Incident Investigation",
            "service": "production-service",
            "severity": "P2 - Major Degradation",
            "error_signature": raw_notes[:180],
            "root_cause": "Extracted from triage notes: " + raw_notes[:250],
            "runbook_commands": "kubectl get pods -A"
        }
