import { normalizeBaseUrl, DEFAULT_BASE_URL } from '../utils/normalizeBaseUrl.js';

/**
 * Backend environment registry.
 *
 * The uploader can talk to exactly two backends: production, and the dev
 * server exposed through a stable ngrok subdomain. The switch that selects
 * between them ships ONLY in dev/test builds — see SWITCH_ENABLED.
 *
 * This module owns the 'osdb_backend' storage key. utils/storageKeys.js
 * imports FROM here, never the other way around.
 *
 * Design: docs/superpowers/specs/2026-08-14-env-switch-design.md
 */

export const BACKEND_PREF_KEY = 'osdb_backend';

const readEnv = name => {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  return import.meta.env[name] || '';
};

// Compile-time globals (vite `define`), with import.meta.env fallbacks for
// the dev server. Mirrors the pattern already used for the API key.
const PROD_KEY =
  typeof __EMBEDDED_OPENSUBTITLES_API_KEY_PROD__ !== 'undefined' &&
  __EMBEDDED_OPENSUBTITLES_API_KEY_PROD__
    ? __EMBEDDED_OPENSUBTITLES_API_KEY_PROD__
    : readEnv('VITE_OPENSUBTITLES_API_KEY_PROD');

// The legacy single-key variable is accepted as a fallback for DEV only —
// that is what it holds in existing .env files. It is deliberately NOT a
// fallback for the prod key: a silently wrong key against prod Kong is
// worse than a loud startup error.
const DEV_KEY =
  typeof __EMBEDDED_OPENSUBTITLES_API_KEY_DEV__ !== 'undefined' &&
  __EMBEDDED_OPENSUBTITLES_API_KEY_DEV__
    ? __EMBEDDED_OPENSUBTITLES_API_KEY_DEV__
    : readEnv('VITE_OPENSUBTITLES_API_KEY_DEV') || readEnv('VITE_OPENSUBTITLES_API_KEY');

// Unlike PROD_KEY/DEV_KEY/SWITCH_ENABLED above, nothing wires this through
// vite `define` — it is read as a globalThis property (not a bare
// identifier) precisely so it stays inert in every real build. It exists so
// tests can force a usable dev base URL the same way
// storageKeysForcedDevWiring.test.js already forces SWITCH_ENABLED — without
// it, the active environment can never genuinely resolve to 'dev' under
// plain `node --test`, where `import.meta.env` is never populated.
const DEV_BASE_URL_RAW =
  (typeof globalThis !== 'undefined' && globalThis.__EMBEDDED_OPENSUBTITLES_BASE_URL_DEV__) ||
  readEnv('VITE_OPENSUBTITLES_BASE_URL');

export const SWITCH_ENABLED =
  (typeof __ENV_SWITCH_ENABLED__ !== 'undefined' && __ENV_SWITCH_ENABLED__ === 'true') ||
  readEnv('VITE_ENV_SWITCH') === 'true';

// A dev-only build (VITE_USE_DEV_ONLY=true) is for testers of the shared dev
// server: it talks to the dev backend and nothing else. No switch, no stored
// preference and no prod key can bring production back, so a tester cannot
// upload to the live site by accident. It wins over VITE_ENV_SWITCH.
export const DEV_ONLY =
  (typeof __USE_DEV_ONLY__ !== 'undefined' && __USE_DEV_ONLY__ === 'true') ||
  readEnv('VITE_USE_DEV_ONLY') === 'true';

// A web build (VITE_WEB_EMBED=true) runs in an iframe on a page of the
// website (same origin), which owns sign-in: before loading this app the page
// writes the user's JWT where the app keeps its login (localStorage,
// osdb_com_<environment>_jwt), never in the URL, and writes a fresh one and
// reloads the app when it fires `osdb:auth-expired`. So the web build drops
// what only makes sense on the desktop (update checks, API health probes, the
// debug panel, the ad-blocker test page) and never shows its own login box —
// it fires `osdb:login-requested` on its window for the page to handle.
export const WEB_EMBED =
  (typeof __WEB_EMBED__ !== 'undefined' && __WEB_EMBED__ === 'true') ||
  readEnv('VITE_WEB_EMBED') === 'true';

export const requestHostLogin = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osdb:login-requested'));
  }
};

// Production base URL override. Same globalThis-property shape as the dev
// override above, and read from VITE_OPENSUBTITLES_BASE_URL_PROD otherwise.
// Exists so a tester build can reach the API server directly while its public
// routes do not exist yet (e.g. Kong routes still to be defined).
const PROD_BASE_URL_RAW =
  (typeof globalThis !== 'undefined' && globalThis.__EMBEDDED_OPENSUBTITLES_BASE_URL_PROD__) ||
  readEnv('VITE_OPENSUBTITLES_BASE_URL_PROD');

/**
 * Pure registry builder — exported for tests.
 *
 * The production override is honoured ONLY when the switch is enabled. A
 * public build is hard-wired to the canonical API and cannot be redirected,
 * however its build environment is configured. This is the same reasoning as
 * the gating invariant in resolveEnvironmentId: capability that exists for
 * testers must not exist in what ships.
 *
 * When the override is active the label becomes 'Production (direct)', so the
 * switch never claims plain 'Production' while pointing somewhere other than
 * the canonical API. The control must always name the backend it is really
 * talking to.
 */
export function buildEnvironments({
  prodBaseUrl,
  prodKey,
  devBaseUrl,
  devKey,
  switchEnabled,
  devOnly,
} = {}) {
  const prodOverridden = !devOnly && !!switchEnabled && !!prodBaseUrl;
  return Object.freeze({
    // In a dev-only build production has no URL and no key at all, so even
    // code that reads ENVIRONMENTS.prod directly has nothing to send to.
    prod: Object.freeze({
      id: 'prod',
      label: prodOverridden ? 'Production (direct)' : 'Production',
      baseUrl: devOnly ? '' : prodOverridden ? normalizeBaseUrl(prodBaseUrl) : DEFAULT_BASE_URL,
      apiKey: devOnly ? '' : prodKey,
    }),
    dev: Object.freeze({
      id: 'dev',
      label: 'Dev (ngrok)',
      baseUrl: devBaseUrl ? normalizeBaseUrl(devBaseUrl) : '',
      apiKey: devKey,
    }),
  });
}

export const ENVIRONMENTS = buildEnvironments({
  prodBaseUrl: PROD_BASE_URL_RAW,
  prodKey: PROD_KEY,
  devBaseUrl: DEV_BASE_URL_RAW,
  devKey: DEV_KEY,
  switchEnabled: SWITCH_ENABLED,
  devOnly: DEV_ONLY,
});

const VALID_IDS = Object.freeze(['prod', 'dev']);

/**
 * Pure resolver — exported for tests.
 *
 * The gating invariant: when the switch is disabled, this ALWAYS returns
 * 'prod', whatever storage says. A public build must never be dragged onto
 * the dev backend by a leftover preference from a tester build.
 *
 * It also refuses to resolve to an environment with no usable `baseUrl`
 * (§6 of the design doc: "Stored env id unknown or unselectable → fall back
 * to the first-run default"). A switch-enabled build with no dev base URL
 * configured — or a stored `'dev'` preference surviving into such a build —
 * must land on 'prod', not on a backend that resolves to a bare path against
 * the app's own origin.
 *
 * @param {Storage|null} storage
 * @param {boolean} switchEnabled
 * A dev-only build always resolves to 'dev', whatever the switch or storage
 * says, even when no dev base URL is configured: requests then fail, which is
 * the safe way to fail. vite.config.js refuses to build that case anyway.
 *
 * @param {object} [environments] environment registry, injectable for tests
 * @param {boolean} [devOnly]
 * @returns {'prod'|'dev'}
 */
export function resolveEnvironmentId(
  storage,
  switchEnabled,
  environments = ENVIRONMENTS,
  devOnly = DEV_ONLY
) {
  if (devOnly) return 'dev';
  if (!switchEnabled) return 'prod';
  const devUsable = !!environments?.dev?.baseUrl;
  const fallback = devUsable ? 'dev' : 'prod';
  if (!storage || typeof storage.getItem !== 'function') return fallback;
  let stored = null;
  try {
    stored = storage.getItem(BACKEND_PREF_KEY);
  } catch {
    return fallback;
  }
  if (!VALID_IDS.includes(stored)) return fallback;
  if (stored === 'dev' && !devUsable) return 'prod';
  return stored;
}

/**
 * Pure list builder — exported for tests.
 * @returns {Array<object>} prod first, then dev when it is configured; empty in a dev-only build
 */
export function buildSelectableList(switchEnabled, environments, devOnly = DEV_ONLY) {
  if (devOnly || !switchEnabled) return [];
  return VALID_IDS.map(id => environments[id]).filter(env => env && env.baseUrl);
}

const defaultStorage = () =>
  typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;

export function getActiveEnvironmentId(storage = defaultStorage()) {
  return resolveEnvironmentId(storage, SWITCH_ENABLED);
}

export function getActiveEnvironment(storage = defaultStorage()) {
  return ENVIRONMENTS[getActiveEnvironmentId(storage)];
}

export function listSelectableEnvironments() {
  return buildSelectableList(SWITCH_ENABLED, ENVIRONMENTS);
}

/**
 * Persist the choice and reload so every module re-resolves the backend.
 *
 * @param {'prod'|'dev'} id
 * @param {{storage?: Storage, reload?: Function, switchEnabled?: boolean, devOnly?: boolean}} deps injectable for tests
 * @returns {boolean} true when a reload was triggered
 */
export function setActiveEnvironment(id, deps = {}) {
  const storage = deps.storage ?? defaultStorage();
  const switchEnabled = deps.switchEnabled ?? SWITCH_ENABLED;
  if (deps.devOnly ?? DEV_ONLY) return false;
  const reload =
    deps.reload ??
    (() => {
      if (typeof window !== 'undefined') window.location.reload();
    });

  if (!VALID_IDS.includes(id) || !switchEnabled) return false;
  if (resolveEnvironmentId(storage, switchEnabled) === id) return false;

  try {
    storage?.setItem(BACKEND_PREF_KEY, id);
  } catch {
    return false;
  }
  reload();
  return true;
}
