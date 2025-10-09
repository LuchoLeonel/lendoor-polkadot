"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useLocation } from "react-router-dom";

/* Stored steps (persisted) */
export const STORED_USER_JOURNEYS = [
  "deposit_usdc",
  "deposit_susdc",
  "withdraw_susdc",
  "withdraw_usdc",
  "verify_identity",
  "borrow",
  "repay",
  "use_teleporter",
  "use_timetravel",
] as const;
type StoredJourney = (typeof STORED_USER_JOURNEYS)[number];

/* Public type includes 'login' (not persisted) */
export type UserJourney = StoredJourney | "login";

const DEFAULT_LOGGED_IN: StoredJourney = STORED_USER_JOURNEYS[0];
const DEFAULT_LOGGED_OUT: UserJourney = "login";

/* Derived groups only care about stored journeys */
const ONLY_BORROW_SET = new Set<StoredJourney>([
  "verify_identity",
  "borrow",
  "use_teleporter",
  "use_timetravel",
]);
const BORROW_SET = new Set<StoredJourney>([...ONLY_BORROW_SET, "repay"]);
const LEND_SET = new Set<StoredJourney>([
  "deposit_usdc",
  "deposit_susdc",
  "withdraw_susdc",
  "withdraw_usdc",
]);

/* Utils */
const isStoredJourney = (v: unknown): v is StoredJourney =>
  typeof v === "string" && (STORED_USER_JOURNEYS as readonly string[]).includes(v);

const normalizeWallet = (w?: string | null) => (w ?? "").trim().toLowerCase();
const hasWindow = () => typeof window !== "undefined";

/* Keys (null when no wallet => no storage I/O) */
const kStep = (w?: string | null) => {
  const id = normalizeWallet(w);
  return id ? `UJ_STEP:${id}` : null;
};

/* LocalStorage I/O for stored journeys */
function readStep(wallet?: string | null): StoredJourney {
  if (!hasWindow()) return DEFAULT_LOGGED_IN;
  const key = kStep(wallet);
  if (!key) return DEFAULT_LOGGED_IN;
  const raw = window.localStorage.getItem(key);
  return isStoredJourney(raw) ? raw : DEFAULT_LOGGED_IN;
}
function writeStep(wallet: string | null | undefined, step: StoredJourney) {
  if (!hasWindow()) return;
  const key = kStep(wallet);
  if (!key) return;
  window.localStorage.setItem(key, step);
}
function ensureStep(wallet?: string | null): StoredJourney {
  if (!hasWindow()) return DEFAULT_LOGGED_IN;
  const key = kStep(wallet);
  if (!key) return DEFAULT_LOGGED_IN;
  const step = readStep(wallet);
  const raw = window.localStorage.getItem(key);
  if (!isStoredJourney(raw)) window.localStorage.setItem(key, step);
  return step;
}

/* Path helpers */
export function normalizePath(p?: string | null): string {
  if (!p) return "/";
  const cleaned = p.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return cleaned === "" ? "/" : cleaned;
}
export function inSection(pathname: string | null | undefined, base: string) {
  const p = normalizePath(pathname);
  const b = normalizePath(base);
  return p === b || p.startsWith(b + "/");
}

/* Context */
type Ctx = {
  value: UserJourney;
  set: (next: UserJourney) => Promise<void>;
  updateJourney: (next: UserJourney) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  ready: boolean;
  loading: boolean;
  error: string | null;
  is_borrow: boolean;
  is_only_borrow: boolean;
  is_lend: boolean;
  pathname: string;
};

const UserJourneyContext = createContext<Ctx | null>(null);

/* Provider */
export function UserJourneyProvider({
  children,
  walletAddress,
}: {
  children: ReactNode;
  walletAddress?: string | null;
}) {
  const [value, setValue] = useState<UserJourney>(DEFAULT_LOGGED_OUT);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const pathname = normalizePath(location?.pathname || "/");

  const { primaryWallet } = useDynamicContext();
  const providedWallet = useMemo(() => normalizeWallet(walletAddress), [walletAddress]);
  const dynamicWallet = useMemo(
    () => normalizeWallet((primaryWallet as any)?.address),
    [primaryWallet],
  );
  const wallet = providedWallet || dynamicWallet || null;

  useEffect(() => {
    setReady(false);
    setLoading(true);
    setError(null);
    try {
      if (!wallet) {
        setValue(DEFAULT_LOGGED_OUT); // 'login'
      } else {
        setValue(ensureStep(wallet));
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to initialize local journey");
      setValue(wallet ? DEFAULT_LOGGED_IN : DEFAULT_LOGGED_OUT);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [wallet]);

  const set = useCallback(
    async (next: UserJourney) => {
      if (!wallet) {
        // Logged out: context only, never persist
        setValue("login");
        return;
      }
      if (next === "login") {
        // Logged in but asked to show login -> context only
        setValue("login");
        return;
      }
      if (!isStoredJourney(next)) return;
      setLoading(true);
      setError(null);
      try {
        writeStep(wallet, next);
        setValue(next);
      } catch (e: any) {
        setError(e?.message ?? "Failed to save journey step");
      } finally {
        setLoading(false);
        setReady(true);
      }
    },
    [wallet],
  );

  // Step update convenience wrapper
  const updateJourney = useCallback(
    async (next: UserJourney) => {
      await set(next);
    },
    [set],
  );

  const clear = useCallback(async () => {
    await set(wallet ? DEFAULT_LOGGED_IN : DEFAULT_LOGGED_OUT);
  }, [set, wallet]);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setValue(DEFAULT_LOGGED_OUT);
      return;
    }
    setValue(ensureStep(wallet));
  }, [wallet]);

  /* Derived flags (only true for stored journeys) */
  const onBorrowPage = useMemo(() => inSection(pathname, "/borrow"), [pathname]);
  const onLendPage = useMemo(() => inSection(pathname, "/lend"), [pathname]);

  const is_only_borrow = useMemo(
    () => (isStoredJourney(value) ? ONLY_BORROW_SET.has(value) : false),
    [value],
  );
  const is_borrow = useMemo(
    () => (isStoredJourney(value) ? BORROW_SET.has(value) && !onBorrowPage : false),
    [value, onBorrowPage],
  );
  const is_lend = useMemo(
    () => (isStoredJourney(value) ? LEND_SET.has(value) && !onLendPage : false),
    [value, onLendPage],
  );

  const ctx = useMemo<Ctx>(
    () => ({
      value,
      set,
      updateJourney,
      clear,
      refresh,
      ready,
      loading,
      error,
      is_borrow,
      is_only_borrow,
      is_lend,
      pathname,
    }),
    [
      value,
      set,
      updateJourney,
      clear,
      refresh,
      ready,
      loading,
      error,
      is_borrow,
      is_only_borrow,
      is_lend,
      pathname,
    ],
  );

  return <UserJourneyContext.Provider value={ctx}>{children}</UserJourneyContext.Provider>;
}

/* Hook */
export function useUserJourney() {
  const ctx = useContext(UserJourneyContext);
  if (!ctx) throw new Error("useUserJourney must be used within <UserJourneyProvider>");
  return ctx;
}

/* Helpers */
export const isOnlyBorrowJourney = (j: UserJourney) =>
  isStoredJourney(j) && ONLY_BORROW_SET.has(j as StoredJourney);
export const isBorrowJourney = (j: UserJourney) =>
  isStoredJourney(j) && BORROW_SET.has(j as StoredJourney);
export const isLendJourney = (j: UserJourney) =>
  isStoredJourney(j) && LEND_SET.has(j as StoredJourney);
