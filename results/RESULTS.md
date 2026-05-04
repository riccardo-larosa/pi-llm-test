# Shopping Cart LLM Benchmark — Results

Generated: 2026-05-03T22:00:49.484Z

| Rank | Submission | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `opus4.7` | 96.1 | 100 | 100 | 73.8 | 100 | 172 | 420 | 206 | 0.29 | 2.87 | 6633 | 520 |
| 2 | `_reference` | 95.5 | 100 | 100 | 70.3 | 100 | 177 | 97 | 418 | 0.64 | 3.19 | 3464 | 542 |
| 3 | `gpt-5.5` | 95.2 | 100 | 100 | 67.8 | 100 | 177 | 424 | 205 | 0.28 | 3.42 | 10490 | 523 |
| 4 | `kimi2.6` | 94.6 | 100 | 100 | 63.8 | 100 | 181 | 98 | 410 | 0.39 | 4.46 | 6618 | 511 |
| 5 | `qwen3.6` | 85.8 | 85.7 | 100 | 62.2 | 100 | 180 | 614 | 611 | 1 | 1.38 | 16358 | 513 |

## Per-submission correctness breakdown

### `opus4.7` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence

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

### `kimi2.6` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence

### `qwen3.6` — passed 6/7
- ✅ products_listed
- ❌ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence
