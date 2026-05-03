# Shopping Cart LLM Benchmark — Results

Generated: 2026-05-03T20:27:41.042Z

| Rank | Submission | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `_reference` | 99.3 | 100 | 100 | 95.3 | 100 | 1171 | 96 | 614 | 0.54 | 3.55 | 3464 | 551 |
| 2 | `gpt-5.5` | 95.7 | 100 | 100 | 71.1 | 100 | 191 | 428 | 206 | 1.05 | 3.07 | 10490 | 523 |

## Per-submission correctness breakdown

### `_reference` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence

### `gpt-5.5` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence
