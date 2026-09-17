# CRYPFLOW

A focused Solana wallet intelligence dashboard built with Expo + React Native +
TypeScript. No Solana SDK — it talks directly to Solana's public JSON-RPC
endpoint with `fetch()`.

## Setup

1. Create a fresh Expo project (or use this folder directly if you already
   have one):
   ```bash
   npx create-expo-app SolScan --template blank-typescript
   ```
2. Copy `App.tsx` from this folder into your project, replacing the
   generated one.
3. Install dependencies and start:
   ```bash
   cd SolScan
   npm install
   npx expo start
   ```
4. Install **Expo Go** on your phone (App Store / Play Store), then scan the
   QR code shown in your terminal.

## What it does

- Reads a wallet's SOL balance (`getBalance`)
- Reads SPL token holdings, e.g. USDC, Bonk (`getTokenAccountsByOwner`)
- Reads the last 10 transactions (`getSignaturesForAddress`)
- Tapping a transaction opens it on solscan.io

## Try it

Paste a real wallet address into the search box, for example:
```
CKs4Eoiys1jB6MAoHBNjVMjYRQBhmcVJBxiDvJT7yojo
```

## Notes

- Uses Solana's free public RPC (`api.mainnet-beta.solana.com`), which is
  rate-limited (~10 req/s). For a real app, swap `RPC` in `App.tsx` for a
  provider like Helius (free tier: 500K requests/month).
- No state management library, no Axios, no Solana web3.js — everything is
  built-in `fetch()` and React hooks, on purpose, per the project's "keep it
  simple" scope.
- Next steps from your notes: Week 3 adds wallet-app deep linking / camera
  features (better suited to a physical device or emulator, not iOS
  Simulator).
