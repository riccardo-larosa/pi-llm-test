# Shopping Cart LLM Benchmark — Results

Generated: 2026-05-04T03:00:35.083Z

| Rank | Submission | Tokens | Cost | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `qwen3.6` | 622,252 | $0.27 | 96.4 | 100 | 100 | 75.8 | 100 | 218 | 639 | 611 | 0.38 | 1.09 | 11678 | 512 |
| 2 | `opus4.7` | 541,132 | $1.67702 | 96 | 100 | 100 | 73.2 | 100 | 184 | 444 | 207 | 0.29 | 2.39 | 6633 | 519 |
| 3 | `_reference` | — | — | 95.1 | 100 | 100 | 67.5 | 100 | 187 | 93 | 421 | 0.66 | 3.07 | 3464 | 555 |
| 4 | `gpt-5.5` | 1,612,686 | $3.827444 | 94.9 | 100 | 100 | 65.9 | 100 | 166 | 550 | 206 | 0.28 | 3.34 | 10490 | 521 |
| 5 | `kimi2.6` | 529,398 | $0.2641 | 93.8 | 100 | 100 | 58.5 | 100 | 190 | 91 | 411 | 0.6 | 3.1 | 6618 | 511 |
| 6 | `deepseek4` | 358,771 | $0.0413 | 93.2 | 100 | 100 | 54.6 | 100 | 176 | 473 | 211 | 0.59 | 3.2 | 9057 | 519 |

## Per-submission correctness breakdown

### `qwen3.6` — passed 7/7
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

### `deepseek4` — passed 7/7
- ✅ products_listed
- ✅ cart_initially_empty
- ✅ post_creates_item
- ✅ duplicate_post_handled
- ✅ patch_updates_quantity
- ✅ delete_removes_item
- ✅ restart_persistence
