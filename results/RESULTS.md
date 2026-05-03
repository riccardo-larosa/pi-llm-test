# Shopping Cart LLM Benchmark — Results

Generated: 2026-05-03T21:24:19.080Z

| Rank | Submission | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `_reference` | 98.2 | 100 | 100 | 88.3 | 100 | 188 | 108 | 412 | 0.53 | 2.44 | 3464 | 550 |
| 2 | `opus4.7` | 96.6 | 100 | 100 | 77.5 | 100 | 172 | 427 | 207 | 0.44 | 2.79 | 6633 | 521 |
| 3 | `gpt-5.5` | 95.7 | 100 | 100 | 71.5 | 100 | 173 | 437 | 207 | 0.31 | 4.55 | 10490 | 524 |

## Per-submission correctness breakdown

### `_reference` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence

### `opus4.7` — passed 7/7
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
