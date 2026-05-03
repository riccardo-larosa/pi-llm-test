export type BuildResult = {
  install_ok: boolean;
  install_ms: number;
  install_log: string;
  build_ok: boolean;
  build_ms: number;
  build_log: string;
};

export type StartupResult = {
  startup_ok: boolean;
  startup_ms: number;
  startup_log: string;
};

export type CorrectnessResult = {
  correctness_total: number;
  correctness_passed: number;
  tests: {
    products_listed: boolean;
    cart_initially_empty: boolean;
    post_creates_item: boolean;
    duplicate_post_handled: boolean;
    patch_updates_quantity: boolean;
    delete_removes_item: boolean;
    restart_persistence: boolean;
  };
  primed_item_id: string | null;
};

export type PerfResult = {
  get_cart_p50_ms: number;
  get_cart_p95_ms: number;
  post_item_p50_ms: number;
  post_item_p95_ms: number;
};

export type FrontendResult = {
  frontend_ok: boolean;
  page_rendered: boolean;
  add_works: boolean;
  remove_works: boolean;
  bundle_bytes: number;
  dom_loaded_ms: number;
};

export type SubmissionResult = {
  name: string;
  build: BuildResult;
  startup: StartupResult;
  correctness: CorrectnessResult;
  perf: PerfResult | null;
  frontend: FrontendResult | null;

  // populated by score.ts
  correctness_pct: number;
  frontend_pct: number;
  perf_pct: number;
  build_pct: number;
  composite: number;
};
