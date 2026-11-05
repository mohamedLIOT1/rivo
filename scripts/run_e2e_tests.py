#!/usr/bin/env python3
"""
Rivo E2E Automated Test Suite & Regression Runner
Authoritative Opaque-Box Test Runner for Rivo Engineering Transition (MT Track).

Usage:
    python scripts/run_e2e_tests.py
    python scripts/run_e2e_tests.py --tier 1
    python scripts/run_e2e_tests.py --tier 1,2
    python scripts/run_e2e_tests.py --pattern test_splashscreen*
    python scripts/run_e2e_tests.py --json-report results.json
    python scripts/run_e2e_tests.py --baseline
"""

import sys
import os
import argparse
import unittest
import time
import json
from pathlib import Path
from io import StringIO

# Ensure project root is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
TESTS_DIR = PROJECT_ROOT / "tests" / "e2e"

# Reconfigure stdout/stderr to UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


TIER_MODULE_MAP = {
    1: "tests.e2e.test_tier1_features",
    2: "tests.e2e.test_tier2_boundaries",
    3: "tests.e2e.test_tier3_combinations",
    4: "tests.e2e.test_tier4_workloads",
}

TIER_NAMES = {
    1: "Tier 1: Feature Coverage (10 Inventoried Features)",
    2: "Tier 2: Boundary & Corner Cases",
    3: "Tier 3: Cross-Feature Combinations & State Determinism",
    4: "Tier 4: Real-World Workload Scenarios & Benchmarks",
}


class ColoredTestResult(unittest.TextTestResult):
    """Custom test result formatter that tracks per-tier pass/fail metrics."""

    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.test_records = []
        self.start_times = {}

    def startTest(self, test):
        self.start_times[test.id()] = time.perf_counter()
        super().startTest(test)

    def addSuccess(self, test):
        elapsed = time.perf_counter() - self.start_times.get(test.id(), time.perf_counter())
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "status": "PASS",
            "elapsed_ms": round(elapsed * 1000, 2),
            "message": None,
        })
        super().addSuccess(test)

    def addFailure(self, test, err):
        elapsed = time.perf_counter() - self.start_times.get(test.id(), time.perf_counter())
        msg = self._exc_info_to_string(err, test)
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "status": "FAIL",
            "elapsed_ms": round(elapsed * 1000, 2),
            "message": msg,
        })
        super().addFailure(test, err)

    def addError(self, test, err):
        elapsed = time.perf_counter() - self.start_times.get(test.id(), time.perf_counter())
        msg = self._exc_info_to_string(err, test)
        self.test_records.append({
            "id": test.id(),
            "name": test._testMethodName,
            "class": test.__class__.__name__,
            "status": "ERROR",
            "elapsed_ms": round(elapsed * 1000, 2),
            "message": msg,
        })
        super().addError(test, err)


def run_test_suite(tiers=None, pattern=None, json_report_path=None, baseline=False):
    """
    Execute tests across selected tiers, calculate metrics, and format console/JSON output.
    """
    if not tiers:
        tiers = [1, 2, 3, 4]

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    tier_suites = {}
    for tier in sorted(tiers):
        module_name = TIER_MODULE_MAP.get(tier)
        if not module_name:
            continue
        try:
            mod = __import__(module_name, fromlist=["*"])
            if pattern:
                ts = loader.loadTestsFromName(pattern, mod)
            else:
                ts = loader.loadTestsFromModule(mod)
            tier_suites[tier] = ts
            suite.addTest(ts)
        except Exception as e:
            print(f"❌ Failed loading {module_name}: {e}")

    total_tests_loaded = suite.countTestCases()
    print("=" * 80)
    print("🧪 RIVO ENGINEERING TRANSITION — E2E TEST RUNNER")
    print("=" * 80)
    print(f"Target Directory: {PROJECT_ROOT}")
    print(f"Selected Tiers:   {tiers}")
    print(f"Total Test Cases: {total_tests_loaded}")
    print("=" * 80)
    print()

    stream = StringIO()
    runner = unittest.TextTestRunner(
        stream=stream,
        resultclass=ColoredTestResult,
        verbosity=2,
    )

    start_wall = time.perf_counter()
    result = runner.run(suite)
    duration_sec = time.perf_counter() - start_wall

    records = getattr(result, "test_records", [])

    # Group metrics by tier
    tier_metrics = {}
    for tier in tiers:
        mod_key = f"tier{tier}"
        tier_recs = [r for r in records if mod_key in r["id"].lower()]
        passed = sum(1 for r in tier_recs if r["status"] == "PASS")
        failed = sum(1 for r in tier_recs if r["status"] in ("FAIL", "ERROR"))
        tier_metrics[tier] = {
            "name": TIER_NAMES.get(tier, f"Tier {tier}"),
            "total": len(tier_recs),
            "passed": passed,
            "failed": failed,
            "records": tier_recs,
        }

    # Print summary table
    print("📊 TIER SUMMARY BREAKDOWN:")
    print("-" * 80)
    print(f"{'Tier':<6} | {'Description':<52} | {'Pass':<5} | {'Fail':<5} | {'Total':<5}")
    print("-" * 80)

    total_pass = sum(m["passed"] for m in tier_metrics.values())
    total_fail = sum(m["failed"] for m in tier_metrics.values())
    total_count = sum(m["total"] for m in tier_metrics.values())

    for t, m in tier_metrics.items():
        print(f"Tier {t:<1} | {m['name'][:52]:<52} | {m['passed']:<5} | {m['failed']:<5} | {m['total']:<5}")
    print("-" * 80)
    print(f"{'TOTAL':<6} | {'All Active Tiers':<52} | {total_pass:<5} | {total_fail:<5} | {total_count:<5}")
    print("=" * 80)
    print(f"Execution completed in {duration_sec:.3f} seconds.")
    print()

    if total_fail > 0:
        print(f"⚠️  {total_fail} test(s) failed. (Baseline signal captured for planned milestones)")
        print()
        print("🔍 SAMPLE FAILED INVARIANTS (Targeted for M1-M6 Fixes):")
        failed_recs = [r for r in records if r["status"] in ("FAIL", "ERROR")]
        for i, fr in enumerate(failed_recs[:10], 1):
            short_id = fr["id"].split(".")[-2:]
            print(f"  {i}. {'.'.join(short_id)}")
            first_err_line = fr["message"].strip().split("\n")[-1] if fr["message"] else "Failed"
            print(f"     -> {first_err_line[:90]}")
        if len(failed_recs) > 10:
            print(f"  ... and {len(failed_recs) - 10} more.")
        print()

    # Emit JSON report if requested
    if json_report_path:
        report_data = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "duration_sec": round(duration_sec, 3),
            "total": total_count,
            "passed": total_pass,
            "failed": total_fail,
            "pass_rate_pct": round((total_pass / total_count * 100.0) if total_count else 0, 2),
            "tiers": {
                str(t): {
                    "name": m["name"],
                    "total": m["total"],
                    "passed": m["passed"],
                    "failed": m["failed"],
                }
                for t, m in tier_metrics.items()
            },
            "records": records,
        }
        out_path = Path(json_report_path)
        out_path.write_text(json.dumps(report_data, indent=2), encoding="utf-8")
        print(f"📄 JSON test report written to: {out_path.resolve()}")
        print()

    if baseline:
        print("ℹ️  Runner executed in --baseline mode. Exiting with status 0.")
        return 0

    return 0 if total_fail == 0 else 1


def main():
    parser = argparse.ArgumentParser(
        description="Rivo E2E Automated Test Suite & Regression Runner",
    )
    parser.add_argument(
        "--tier",
        type=str,
        default="all",
        help="Comma-separated list of tiers to run (e.g. 1, 2, 3, 4, or 'all')",
    )
    parser.add_argument(
        "--pattern",
        type=str,
        default=None,
        help="Optional test pattern / name filter",
    )
    parser.add_argument(
        "--json-report",
        type=str,
        default=None,
        help="File path to save JSON metrics report",
    )
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Run without failing exit code to capture baseline state",
    )

    args = parser.parse_args()

    if args.tier.lower() == "all":
        tiers = [1, 2, 3, 4]
    else:
        try:
            tiers = [int(x.strip()) for x in args.tier.split(",") if x.strip()]
        except ValueError:
            print(f"Invalid tier argument: {args.tier}. Expected integers like '1,2' or 'all'")
            sys.exit(2)

    exit_code = run_test_suite(
        tiers=tiers,
        pattern=args.pattern,
        json_report_path=args.json_report,
        baseline=args.baseline,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
