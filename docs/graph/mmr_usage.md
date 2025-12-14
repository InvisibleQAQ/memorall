# MMR (Maximal Marginal Relevance) - Usage Guide

## Overview

MMR is a diversity algorithm that balances **relevance** and **diversity** when selecting results. It prevents redundant, overly-similar results and ensures broader coverage of query aspects.

### The Problem MMR Solves

**Without MMR:**
```
Query: "React hooks"

Results (all very similar):
1. useState - basic usage (similarity: 0.92)
2. useState - API reference (similarity: 0.91)
3. useState - examples (similarity: 0.90)
4. useState - best practices (similarity: 0.89)
5. useState - common mistakes (similarity: 0.88)

→ Redundant! All about useState.
```

**With MMR (balanced mode):**
```
Query: "React hooks"

Results (diverse):
1. useState - basic usage (similarity: 0.92)
2. useEffect hook (similarity: 0.75, diverse from useState)
3. useContext hook (similarity: 0.70, diverse from both)
4. Custom hooks (similarity: 0.68, different aspect)
5. Hooks rules (similarity: 0.65, different perspective)

→ Better coverage! Multiple aspects of React hooks.
```

---

## Configuration

### MMR Modes

MMR has **3 preset modes** plus a **custom mode**:

| Mode | Lambda (λ) | Relevance | Diversity | Best For |
|------|-----------|-----------|-----------|----------|
| **focused** | 0.8 | 80% | 20% | Precise queries, when you want highly relevant results |
| **balanced** | 0.6 | 60% | 40% | General use (**DEFAULT**, recommended) |
| **explore** | 0.4 | 40% | 60% | Broad queries, discovering new aspects |
| **custom** | 0.0-1.0 | configurable | configurable | Fine-tuned control |

### Understanding Lambda (λ)

Lambda controls the trade-off:

```
MMR Score = λ × Relevance - (1-λ) × Similarity to Selected

λ = 1.0 → Pure relevance (no diversity, same as disabling MMR)
λ = 0.6 → Balanced (60% relevance, 40% diversity)
λ = 0.0 → Pure diversity (ignore relevance, not recommended!)
```

**Rule of thumb:**
- Higher λ (0.7-0.9) = more precision, may have some redundancy
- Lower λ (0.3-0.5) = more variety, may miss some relevant results

---

## Usage Examples

### 1. Default Configuration (Balanced Mode)

```typescript
import { SmartRetrievalFlow } from "./smart-retrieval";

// MMR enabled by default with balanced mode
const smartRetrieval = new SmartRetrievalFlow(services);

// MMR will automatically:
// - Fetch 40 candidates (2× nodeLimit of 20)
// - Select 20 diverse nodes using λ=0.6
// - Balance relevance and diversity
```

### 2. Disable MMR

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    mmr: {
      enabled: false,  // Disable MMR
    },
  },
});

// Will use pure semantic search (top-K by similarity)
// Faster but may have redundant results
```

### 3. Focused Mode (More Relevance)

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    mmr: {
      enabled: true,
      mode: "focused",  // λ=0.8
    },
  },
});

// Best for: Specific queries where precision matters
// Example: "useState API reference"
```

### 4. Explore Mode (More Diversity)

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    mmr: {
      enabled: true,
      mode: "explore",  // λ=0.4
    },
  },
});

// Best for: Broad queries, discovering new topics
// Example: "Learn about React"
```

### 5. Custom Lambda

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    mmr: {
      enabled: true,
      mode: "custom",
      lambda: 0.7,  // 70% relevance, 30% diversity
    },
  },
});

// Fine-tuned control for your specific use case
```

### 6. Adjust Candidate Pool Size

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    nodeLimit: 20,  // Want 20 final results
    mmr: {
      enabled: true,
      mode: "balanced",
      candidateMultiplier: 3,  // Fetch 60 candidates (3× nodeLimit)
    },
  },
});

// Larger candidate pool = more diversity options
// But slower (more vector searches)
//
// candidateMultiplier: 2 (default) - good balance
// candidateMultiplier: 3 - more diversity, slower
// candidateMultiplier: 1.5 - less diversity, faster
```

### 7. Complete Custom Configuration

```typescript
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: {
    nodeLimit: 30,           // Want 30 final nodes
    edgeLimit: 50,           // Want 50 edges
    nodeThreshold: 0.4,      // Lower threshold for more candidates
    edgeThreshold: 0.3,
    mmr: {
      enabled: true,
      mode: "custom",
      lambda: 0.65,          // Custom λ
      candidateMultiplier: 2.5,  // Fetch 75 candidates (2.5 × 30)
    },
  },
  // ... other config
});
```

---

## Use Case Examples

### Use Case 1: Technical Documentation Search

**Scenario:** User searches for "useState hook"

**Best Configuration:**
```typescript
{
  seed: {
    mmr: {
      enabled: true,
      mode: "focused",  // λ=0.8
    },
  },
}
```

**Why:** User wants precise information about useState. Some redundancy (multiple useState docs) is acceptable. High relevance is priority.

---

### Use Case 2: Learning / Exploration

**Scenario:** User searches for "React state management"

**Best Configuration:**
```typescript
{
  seed: {
    mmr: {
      enabled: true,
      mode: "explore",  // λ=0.4
    },
  },
}
```

**Why:** User is learning, wants to see different approaches (useState, useReducer, Context, Redux, etc.). Diversity is more valuable than precision.

---

### Use Case 3: General Q&A

**Scenario:** User asks "How do I manage state in React?"

**Best Configuration:**
```typescript
{
  seed: {
    mmr: {
      enabled: true,
      mode: "balanced",  // λ=0.6 (DEFAULT)
    },
  },
}
```

**Why:** Need good balance. Want relevant results but also show different options. Default balanced mode works well.

---

### Use Case 4: Very Specific Query

**Scenario:** User searches for "useState lazy initialization pattern"

**Best Configuration:**
```typescript
{
  seed: {
    mmr: {
      enabled: false,  // Or mode: "focused" with λ=0.9
    },
  },
}
```

**Why:** Very specific query. User wants all relevant docs even if similar. Diversity less important than precision.

---

## Performance Considerations

### Time Complexity

**Without MMR:** O(N log N) - just sorting
**With MMR:** O(N × K × D)
- N = candidate count
- K = target count
- D = embedding dimensions

**Typical Performance:**

| Candidates | Target | Dimensions | Time |
|------------|--------|------------|------|
| 40 | 20 | 768 | ~5-10ms |
| 60 | 30 | 768 | ~10-20ms |
| 100 | 50 | 768 | ~25-40ms |

**Recommendation:** Use `candidateMultiplier: 2` (default) for best speed/diversity balance.

---

## Monitoring & Debugging

### Logs

When MMR is enabled, you'll see detailed logs:

```typescript
[SMART_RETRIEVAL][P1] Fetching candidates
  - mmrEnabled: true
  - mmrMode: "balanced"
  - targetNodes: 20
  - candidateNodes: 40

[SMART_RETRIEVAL][MMR] Applying MMR to 40 candidates
  - mode: "balanced"
  - lambda: 0.6
  - targetCount: 20

[SMART_RETRIEVAL][MMR] Selected 20 diverse nodes
  - avgSimilarity: 0.742

[SMART_RETRIEVAL][P1] Seed retrieval complete
  - nodes: 20
  - candidates: 40
  - mmrApplied: true
  - avgNodeSim: 0.742
```

### Interpreting Logs

**Good diversity:** `avgSimilarity` decreases after MMR
```
Before MMR (top-40): avgSimilarity: 0.85
After MMR (top-20): avgSimilarity: 0.74
→ Successfully diversified! (11% similarity drop)
```

**No diversity gain:** `avgSimilarity` stays same
```
Before MMR: avgSimilarity: 0.75
After MMR: avgSimilarity: 0.74
→ Candidates already diverse, MMR had minimal effect
```

---

## Best Practices

### ✅ DO:

1. **Use balanced mode by default**
   ```typescript
   mmr: { enabled: true, mode: "balanced" }
   ```

2. **Adjust mode based on query type**
   - Specific queries → `focused`
   - Broad queries → `explore`
   - General queries → `balanced`

3. **Use candidateMultiplier: 2 for most cases**
   - Good balance of diversity and speed

4. **Monitor logs to tune lambda**
   - If too much redundancy → lower λ
   - If missing relevant results → higher λ

### ❌ DON'T:

1. **Don't disable MMR unless you have a reason**
   - Default enabled is recommended

2. **Don't use λ < 0.3 or λ > 0.9**
   - λ < 0.3: Too much diversity, loses relevance
   - λ > 0.9: Minimal diversity benefit

3. **Don't use candidateMultiplier > 3**
   - Diminishing returns on diversity
   - Significantly slower

4. **Don't use focused mode for broad queries**
   - Will miss important diverse results

---

## Advanced: Dynamic Mode Selection

You can dynamically select MMR mode based on query characteristics:

```typescript
function getMMRConfig(query: string): MMRConfig {
  const wordCount = query.split(/\s+/).length;

  if (wordCount <= 3) {
    // Short query = specific, use focused
    return { enabled: true, mode: "focused" };
  } else if (wordCount >= 8) {
    // Long query = exploratory, use explore
    return { enabled: true, mode: "explore" };
  } else {
    // Medium query = balanced
    return { enabled: true, mode: "balanced" };
  }
}

const mmrConfig = getMMRConfig(userQuery);
const smartRetrieval = new SmartRetrievalFlow(services, {
  seed: { mmr: mmrConfig },
});
```

---

## Comparison: MMR vs No MMR

### Scenario: "React hooks"

**Without MMR (Top 10):**
```
1. useState hook (0.92)
2. useState API (0.91)
3. useState examples (0.90)
4. useState best practices (0.89)
5. useState common mistakes (0.88)
6. useState patterns (0.87)
7. useEffect hook (0.85)
8. useEffect API (0.84)
9. useEffect examples (0.83)
10. useEffect cleanup (0.82)

Coverage: 2 hook types (useState, useEffect)
Redundancy: High (multiple docs per hook)
```

**With MMR (λ=0.6, Top 10):**
```
1. useState hook (0.92)
2. useEffect hook (0.85)
3. useContext hook (0.78)
4. useReducer hook (0.75)
5. useMemo hook (0.71)
6. useCallback hook (0.69)
7. useRef hook (0.67)
8. Custom hooks (0.65)
9. Hooks rules (0.63)
10. Hooks testing (0.61)

Coverage: 10 hook types + concepts
Redundancy: Low (one doc per hook)
```

**Winner:** MMR! Much better coverage and diversity.

---

## Summary

**Default (Recommended):**
```typescript
// MMR enabled with balanced mode
const smartRetrieval = new SmartRetrievalFlow(services);
```

**Quick Reference:**

| Goal | Configuration |
|------|---------------|
| **Best overall quality** | `{ mmr: { enabled: true, mode: "balanced" } }` |
| **Maximum precision** | `{ mmr: { enabled: true, mode: "focused" } }` |
| **Maximum diversity** | `{ mmr: { enabled: true, mode: "explore" } }` |
| **Fastest (no diversity)** | `{ mmr: { enabled: false } }` |
| **Custom control** | `{ mmr: { mode: "custom", lambda: 0.65 } }` |

**MMR improves your results by:**
- ✅ Reducing redundancy
- ✅ Increasing coverage
- ✅ Balancing relevance and diversity
- ✅ Providing better user experience

---

## Questions?

**Q: Should I always enable MMR?**
A: Yes, for most use cases. Only disable if you specifically want potentially redundant but highly relevant results.

**Q: What lambda should I use?**
A: Start with 0.6 (balanced). Adjust based on your needs:
- Need more precision? → 0.7-0.8
- Need more diversity? → 0.4-0.5

**Q: How much slower is MMR?**
A: Only 5-20ms overhead for typical configurations. Negligible compared to vector search time.

**Q: Can I use MMR for edges too?**
A: Currently only implemented for nodes. Edges use pure semantic search.

**Q: What if I have very few candidates?**
A: MMR automatically falls back to returning all candidates if count < targetCount.
