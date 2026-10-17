/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Privy App ID. When set, enables "Sign in with Google" + embedded wallets. */
  readonly VITE_PRIVY_APP_ID?: string
}
