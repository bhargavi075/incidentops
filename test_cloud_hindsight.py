"""
test_cloud_hindsight.py - Verifies Hindsight Cloud connectivity and retain/recall primitives.
"""
import os
from hindsight_client import Hindsight
from dotenv import load_dotenv

load_dotenv()

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY")
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "incidentops-bank")

client = Hindsight(
    api_key=HINDSIGHT_API_KEY,
    base_url=HINDSIGHT_BASE_URL
)

print(f"[*] Testing retain() on cloud bank '{BANK_ID}'...")
res_retain = client.retain(
    bank_id=BANK_ID,
    content="Checkout worker HTTP 504 caused by Redis port 6379 pool exhaustion. Fix: redis-cli client kill type normal.",
    context="Service: checkout-service"
)
print("    -> retain result:", res_retain)

print(f"\n[*] Testing recall() on cloud bank '{BANK_ID}'...")
res_recall = client.recall(
    bank_id=BANK_ID,
    query="HTTP 504 on checkout worker"
)
print("    -> recall result:", res_recall)

# Safely display results
if hasattr(res_recall, "results") and res_recall.results:
    print("\n[+] Recalled Memories from Cloud:")
    for idx, r in enumerate(res_recall.results, 1):
        print(f"  {idx}. {r.text}")
else:
    print("\n[!] No records found in cloud bank yet.")

print("\n[+] Verification complete!")