# Shopping Cart LLM Benchmark — Results

Generated: 2026-05-03T17:13:20.449Z

| Rank | Submission | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `_reference` | 100 | 100 | 100 | 100 | 100 | 295 | 91 | 414 | 0.31 | 4.25 | 3464 | 549 |

## Per-submission correctness breakdown

### `_reference` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence
