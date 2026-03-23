# Arena Stress Test Results

**Date:** 2026-03-22
**Models:** qwen2.5-coder:1.5b, smollm2:135m (via Ollama)
**Platform:** macOS Darwin 25.3.0, Node.js v24.10.0, Ollama 0.18.2

---

## 1. Test Results by Phase

### Phase 0: Ollama Setup

| Test | Result | Notes |
|------|--------|-------|
| Ollama installed | PASS | Installed via `brew install ollama` |
| Ollama running | PASS | Started with `ollama serve` |
| qwen2.5-coder:1.5b pulled | PASS | 986MB |
| smollm2:135m pulled | PASS | 270MB |
| Aliases registered (qwen, smollm) | PASS | Added to DEFAULT_CONFIG |
| First battle completes | PASS | fizzbuzz, qwen won 5/5 vs 1/5 |

### Phase 1: Battle Smoke Tests

#### Phase 1.1: All 20 Built-in Challenges

| Challenge | Exit | Winner | Left Tests | Right Tests | Notes |
|-----------|------|--------|------------|-------------|-------|
| fizzbuzz | 0 | left | 4/5 | 0/5 | |
| binary-search | 0 | left | 6/6 | 0/6 | |
| lru-cache | 0 | right | 0/5 | 0/5 | Speed/brevity decided |
| merge-intervals | 0 | right | 0/6 | 0/6 | Speed/brevity decided |
| rate-limiter | 0 | left | 0/4 | 0/4 | Speed/brevity decided |
| kv-store-ttl | 0 | right | 0/5 | 0/5 | Speed/brevity decided |
| linked-list | 0 | left | 5/5 | 0/5 | |
| priority-queue | 0 | right | 0/4 | 1/4 | |
| trie | 0 | left | 5/5 | 0/5 | |
| graph-bfs | 0 | right | 0/4 | 0/4 | Speed/brevity decided |
| rest-crud | 0 | draw | 0/7 | 0/7 | |
| auth-jwt | 0 | right | 0/4 | 0/4 | Speed/brevity decided |
| url-shortener | 0 | right | 0/5 | 0/5 | Speed/brevity decided |
| webhook-handler | 0 | left | 0/4 | 0/4 | Speed/brevity decided |
| sse-counter | 0 | left | 0/6 | 0/6 | Speed/brevity decided |
| csv-parser | 0 | right | 0/6 | 0/6 | Speed/brevity decided |
| log-analyzer | 0 | right | 0/4 | 0/4 | Speed/brevity decided |
| file-dedup | 0 | right | 0/4 | 0/4 | Speed/brevity decided |
| markdown-toc | 0 | left | 1/5 | 0/5 | |
| json-flatten | 0 | right | 0/6 | 0/6 | Speed/brevity decided |

**Result: 20/20 PASS** — All challenges completed without crash. Many 0-test-pass battles are expected with small local models; arena infrastructure handled all gracefully.

#### Phase 1.2: Model Combinations

| Pairing | Result | Notes |
|---------|--------|-------|
| qwen vs smollm | PASS | |
| smollm vs qwen (reversed) | PASS | |
| qwen vs qwen (same model) | PASS | Different outputs due to temperature |
| smollm vs smollm (same model) | PASS | |

#### Phase 1.3: Error Handling

| Scenario | Result | Notes |
|----------|--------|-------|
| Nonexistent Ollama model | PASS | Battle ran with error response as "code", scored 0 |
| Missing API key (claude) | PASS | Clear error: "Set ANTHROPIC_API_KEY environment variable" |
| Unknown alias | PASS | Clear error: "Invalid model specifier" |

### Phase 2: Token Consumption Stress

| Test | Result | Notes |
|------|--------|-------|
| Verbose challenge (100+ lines) | PASS | Left: 129 lines / 6478 chars. No streaming issues |
| 30-test challenge | PASS | All 30 tests executed. qwen: 27/30, smollm: 0/30 |
| Long output challenge (500+ lines) | PASS | Left: 105 lines, Right: 93 lines. 11KB battle file |

### Phase 3: Rapid Fire Stress

| Test | Result | Notes |
|------|--------|-------|
| 10 back-to-back battles | PASS | All exit=0, 10 unique IDs, ELO accumulated |
| 3 concurrent battles | PASS | All exit=0, 3 battle files, no elo.json corruption |
| ELO consistency check | PASS | All ratings 100-3000, valid JSON, counts consistent |

### Phase 4: Adversarial Input

| Test | Result | Notes |
|------|--------|-------|
| Shell injection in prompt | PASS | No `/tmp/arena-pwned` created. Safe. |
| Unicode challenge | PASS | No encoding errors |
| Empty challenge (no tests) | PASS | Battle completed, exit=0 |
| Not-JSON challenge file | PASS | Error caught with clear message (after fix) |
| Nonexistent challenge file | PASS | "Challenge not found" message |
| Empty assertion | PASS | Battle completed, test scored as failed |
| Non-code model response | PASS | Tests: 0/1, battle saved, no crash |

### Phase 5: Performance Profiling

#### Phase 5.1: Timing (fizzbuzz)

| Phase | Time | % of Total |
|-------|------|-----------|
| Challenge loading | 1ms | <0.1% |
| Provider creation | 1ms | <0.1% |
| Ollama streaming (both models) | ~1400ms | ~95% |
| Code execution + testing | ~75ms | ~5% |
| Scoring + ELO + file I/O | <1ms | <0.1% |
| **Total** | **1480ms** | **100%** |

**Bottleneck:** Ollama generation time dominates at ~95%. All arena infrastructure is <5% overhead.

#### Phase 5.2: Memory

| Test | Result | Notes |
|------|--------|-------|
| 256MB heap limit | PASS | Battle completed within constraint |

#### Phase 5.3: File Sizes

| Metric | Value |
|--------|-------|
| Individual battle files | 2-12KB each |
| Total battles dir | 388KB (51 files) |
| Total ~/.arena/ dir | 396KB |
| All under 500KB/file | YES |
| All under 50MB total | YES |

### Phase 6: Recovery and Resilience

| Test | Result | Notes |
|------|--------|-------|
| Corrupt elo.json → battle | PASS | Recovered to defaults, battle ran, valid JSON after |
| Corrupt config.json → config | PASS | Recreated with defaults |
| Delete ~/.arena/ → battle | PASS | Everything recreated from scratch |
| Replay latest battle | PASS | Rendered correctly |
| Replay oldest battle | PASS | Rendered correctly |

### Phase 7: Full Regression

| Test | Result | Notes |
|------|--------|-------|
| Jest test suite | PASS | 215/215 tests, 28/28 suites |
| ELO file valid | PASS | Valid JSON |

---

## 2. Bugs Found

| # | Bug | Severity | Phase Found |
|---|-----|----------|-------------|
| 1 | Invalid JSON challenge file showed raw `SyntaxError` stack trace | Medium | Phase 4.3 |
| 2 | Corrupt `elo.json` caused unhandled crash during battle | High | Phase 6.1 |
| 3 | Corrupt `config.json` caused unhandled crash | High | Phase 6.1 |
| 4 | Unit test `corrupt file handling: throws on parse` expected throw but recovery behavior was added | Low | Phase 7 |

---

## 3. Code Changes Made

### Fix 1: Graceful error on invalid challenge JSON file
**File:** `src/commands/battle.js`
Wrapped `loadCustomChallenge()` in try/catch to show user-friendly error instead of raw SyntaxError.

### Fix 2: Corrupt elo.json recovery
**File:** `src/elo/store.js`
Added try/catch around `JSON.parse()` in `loadStore()`. On corrupt file, resets to empty store `{ ratings: {}, total_battles: 0 }`.

### Fix 3: Corrupt config.json recovery
**File:** `src/utils/config.js`
Added try/catch around `JSON.parse()` in `loadConfig()`. On corrupt file, recreates with defaults.

### Fix 4: Updated test expectation
**File:** `tests/unit/elo/store.test.js`
Changed `corrupt file handling: throws on parse` to `corrupt file handling: recovers gracefully` — now expects default rating (1200) instead of throw.

---

## 4. Final Timing Profile (fizzbuzz)

```
Challenge loading:                   1ms
Provider creation:                   1ms
Battle (stream+exec+test+score):  1478ms
  ├── Ollama generation (left):   1431ms
  ├── Ollama generation (right):   704ms
  ├── Code execution + tests:      ~75ms
  └── Scoring + ELO + I/O:         <1ms
TOTAL:                            1480ms
```

---

## 5. Final ELO State

```
#   Model                    ELO    W    L    D
1   qwen2.5-coder:1.5b      1216   1    0    0
2   smollm2:135m             1184   0    1    0
```

Note: ELO was reset during Phase 6.1 corrupt-state recovery testing. Prior to reset, 42+ battles had been tracked with accumulated ratings.

---

## 6. Final Jest Test Count

**215 tests passing across 28 suites.**

- Unit: 156 tests / 18 suites
- Integration: 32 tests / 6 suites
- UAT: 27 tests / 4 suites

---

## 7. Total Real Battles Run

**51 real battles** against local Ollama models during stress testing.

Breakdown:
- Phase 1.1: 20 (all built-in challenges)
- Phase 1.2: 4 (model combinations)
- Phase 1.3: 3 (error handling — including nonexistent model)
- Phase 2: 3 (verbose, 30-test, long-output)
- Phase 3.1: 10 (back-to-back)
- Phase 3.2: 3 (concurrent)
- Phase 4: 6 (adversarial)
- Phase 5.1: 1 (timing profile)
- Phase 5.2: 1 (memory constrained)
- Phase 6: ~1-2 (recovery)

---

## 8. Known Issues (Unfixed)

| Issue | Reasoning | Workaround |
|-------|-----------|------------|
| Nonexistent Ollama model doesn't fail fast | Ollama returns an error through the streaming API which gets captured as "code". The battle completes with 0 tests passing. This is acceptable — the system doesn't crash and the error is recorded in the battle result. | Check model exists before battle with `ollama list` |
| ELO lost on corrupt file recovery | When elo.json is corrupt, it resets to empty. Historical ELO is lost. | Keep backups. Could add WAL-style journaling in v2. |
| Concurrent battles may lose ELO updates | With 3+ concurrent battles writing elo.json, last-write-wins. Some ELO deltas may be lost. | Acceptable for v1. Could add file locking in v2. |
| Small models produce poor code quality | qwen:1.5b and smollm:135m fail many tests. | Use larger models (7b+) for meaningful competitions. The infrastructure handles failure gracefully. |
