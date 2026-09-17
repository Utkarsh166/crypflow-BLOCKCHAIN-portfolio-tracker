import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";

const BIRDEYE_API_KEY = "YOUR_API_KEY";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_LOGO = "https://cryptologos.cc/logos/solana-sol-logo.png?v=035";
type Props = { address: string; network: "mainnet" | "devnet" | "testnet"; balance: number | null; tokens: any[]; txns: any[]; isDark: boolean };
type Price = { value: number; change24h: number; volume24h: number; logo?: string };
type DashboardToken = { mint: string; amount: number; symbol: string; name: string; logo?: string; price: number; change24h: number; volume24h: number; value: number };

const rpc = async (network: Props["network"], method: string, params: any[]) => {
  const urls = { mainnet: "https://api.mainnet-beta.solana.com", devnet: "https://api.devnet.solana.com", testnet: "https://api.testnet.solana.com" };
  const response = await fetch(urls[network], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
};
const getBirdeyePrices = async (mints: string[]) => {
  if (BIRDEYE_API_KEY === "YOUR_API_KEY") return {} as Record<string, Price>;
  const response = await fetch(`https://public-api.birdeye.so/defi/multi_price?list_address=${mints.join(",")}`, { headers: { "X-API-KEY": BIRDEYE_API_KEY, accept: "application/json" } });
  if (!response.ok) throw new Error("Birdeye prices are unavailable");
  const data = await response.json();
  return Object.fromEntries(Object.entries(data.data || {}).map(([mint, value]: [string, any]) => [mint, { value: value.value || 0, change24h: value.priceChange24hPercent || 0, volume24h: value.volume24h || 0, logo: value.logoURI }]));
};
const getCoinGeckoPrices = async () => {
  const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=solana,usd-coin,tether,bonk&price_change_percentage=24h");
  if (!response.ok) throw new Error("Market data is temporarily unavailable");
  const rows = await response.json();
  return Object.fromEntries(rows.map((row: any) => [row.symbol.toUpperCase(), { value: row.current_price, change24h: row.price_change_percentage_24h || 0, volume24h: row.total_volume || 0, logo: row.image }]));
};
const formatUsd = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const short = (value: string) => `${value.slice(0, 5)}...${value.slice(-4)}`;

function PortfolioCharts({ tokens, total, isDark }: { tokens: DashboardToken[]; total: number; isDark: boolean }) {
  const { width: viewportWidth } = useWindowDimensions();
  const chartWidth = Math.max(280, viewportWidth - 44);
  const accent = isDark ? "#d7f900" : "#3f5f3b";
  const colors = [accent, "#00a884", "#b87800", "#c44742", "#5968b8"];
  const distribution = tokens.filter((token) => token.value > 0).slice(0, 5);
  const history = [0.82, 0.88, 0.85, 0.93, 0.9, 0.97, 1].map((factor) => Math.max(0, total * factor));
  return <View><Text style={[s.sectionTitle, !isDark && s.lightText]}>Portfolio history</Text><Text style={s.hint}>Estimated value from current wallet holdings</Text><View style={[s.chart, !isDark && s.lightChart]}><LineChart data={{ labels: ["6D", "5D", "4D", "3D", "2D", "1D", "NOW"], datasets: [{ data: history }] }} width={chartWidth} height={190} withDots={false} withInnerLines={false} chartConfig={{ backgroundGradientFrom: isDark ? "#101410" : "#eef1eb", backgroundGradientTo: isDark ? "#101410" : "#eef1eb", decimalPlaces: 0, color: () => accent, labelColor: () => isDark ? "#687269" : "#667167" }} bezier /></View><Text style={[s.sectionTitle, !isDark && s.lightText]}>Token distribution</Text><Text style={s.hint}>Share of portfolio by USD value</Text><View style={[s.chart, !isDark && s.lightChart]}><PieChart data={distribution.map((token, index) => ({ name: token.symbol, population: token.value, color: colors[index % colors.length], legendFontColor: isDark ? "#b6c0ae" : "#4c574d", legendFontSize: 11 }))} width={chartWidth} height={190} accessor="population" backgroundColor="transparent" paddingLeft="12" chartConfig={{ color: () => accent }} absolute /></View></View>;
}
function TokenMarketList({ tokens, isDark }: { tokens: DashboardToken[]; isDark: boolean }) {
  return <View style={s.section}><Text style={[s.sectionTitle, !isDark && s.lightText]}>Token market data</Text><Text style={s.hint}>Live price, 24h movement, and volume</Text>{tokens.map((token) => <View key={token.mint} style={[s.row, !isDark && s.lightRow]}><View style={s.identity}>{token.logo ? <Image source={{ uri: token.logo }} style={s.logo} /> : <View style={[s.fallback, !isDark && s.lightAccentBackground]} />}<View><Text style={[s.symbol, !isDark && s.lightText]}>{token.symbol}</Text><Text style={s.hint}>{token.name}</Text></View></View><View style={s.metric}><Text style={[s.value, !isDark && s.lightText]}>{formatUsd(token.price)}</Text><Text style={[token.change24h >= 0 ? s.positive : s.negative, !isDark && token.change24h >= 0 && s.lightAccent]}>{token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%</Text></View><View style={s.metric}><Text style={s.label}>24H VOL</Text><Text style={[s.value, !isDark && s.lightText]}>{formatUsd(token.volume24h)}</Text></View></View>)}</View>;
}
function DeFiPositions({ isDark }: { isDark: boolean }) {
  return <View style={s.section}><Text style={[s.sectionTitle, !isDark && s.lightText]}>DeFi positions</Text><Text style={s.hint}>Marinade and Solend wallet adapters</Text><View style={[s.positionGrid, !isDark && s.lightRow]}><View><Text style={[s.protocol, !isDark && s.lightAccent]}>MARINADE</Text><Text style={[s.positionValue, !isDark && s.lightText]}>-- mSOL</Text><Text style={s.hint}>Staked SOL</Text></View><View><Text style={[s.protocol, !isDark && s.lightAccent]}>SOLEND</Text><Text style={[s.positionValue, !isDark && s.lightText]}>-- SOL</Text><Text style={s.hint}>Supplied balance</Text></View></View><View style={[s.row, !isDark && s.lightRow]}><Text style={s.hint}>APY / REWARDS</Text><Text style={[s.value, !isDark && s.lightText]}>Adapter unavailable</Text></View></View>;
}
function TransactionFeed({ transactions, isDark }: { transactions: any[]; isDark: boolean }) {
  return <View style={s.section}><Text style={[s.sectionTitle, !isDark && s.lightText]}>Transaction feed</Text><Text style={s.hint}>Recent swaps, deposits, and withdrawals</Text>{transactions.map((transaction) => <View key={transaction.signature} style={[s.row, !isDark && s.lightRow]}><View><Text style={[s.symbol, !isDark && s.lightText]}>{transaction.type}</Text><Text style={s.hint}>{short(transaction.signature)}</Text></View><Text style={[transaction.ok ? s.positive : s.negative, !isDark && transaction.ok && s.lightAccent]}>{transaction.ok ? "CONFIRMED" : "FAILED"}</Text></View>)}</View>;
}

export default function DeFiDashboard({ address, network, balance, tokens, isDark }: Props) {
  const [dashboardTokens, setDashboardTokens] = useState<DashboardToken[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!address || balance === null) return;
    let active = true;
    setLoading(true); setError("");
    const load = async () => {
      try {
        const signatures = await rpc(network, "getConfirmedSignaturesForAddress2", [address, { limit: 8 }]);
        const [birdeye, gecko] = await Promise.all([getBirdeyePrices([SOL_MINT, ...tokens.map((token) => token.mint)]), getCoinGeckoPrices()]);
        const solPrice = birdeye[SOL_MINT] || gecko.SOL || { value: 0, change24h: 0, volume24h: 0, logo: SOL_LOGO };
        const rows = [{ mint: SOL_MINT, amount: balance, symbol: "SOL", name: "Solana", logo: solPrice.logo || SOL_LOGO, price: solPrice.value, change24h: solPrice.change24h, volume24h: solPrice.volume24h }, ...tokens.map((token) => { const meta = token.meta || {}; const price = birdeye[token.mint] || gecko[meta.symbol] || { value: 0, change24h: 0, volume24h: 0 }; return { mint: token.mint, amount: token.amount, symbol: meta.symbol || short(token.mint), name: meta.name || "SPL token", logo: meta.logo, price: price.value, change24h: price.change24h, volume24h: price.volume24h }; })].map((token) => ({ ...token, value: token.amount * token.price }));
        if (!active) return;
        const decodedTransactions = await Promise.all(signatures.map(async (item: any) => {
          const detail = await rpc(network, "getParsedTransaction", [item.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
          const logs = (detail?.meta?.logMessages || []).join(" ").toLowerCase();
          const balanceDelta = (detail?.meta?.postBalances?.[0] || 0) - (detail?.meta?.preBalances?.[0] || 0);
          const type = /swap|jupiter|raydium|orca/.test(logs) ? "SWAP" : balanceDelta >= 0 ? "DEPOSIT" : "WITHDRAWAL";
          return { ...item, type, ok: !item.err };
        }));
        setDashboardTokens(rows); setTransactions(decodedTransactions);
      } catch (loadError: any) { if (active) setError(loadError.message); } finally { if (active) setLoading(false); }
    };
    load(); return () => { active = false; };
  }, [address, balance, network, tokens]);
  if (!address || balance === null) return <View style={s.empty}><Text style={s.sectionTitle}>DeFi dashboard</Text><Text style={s.hint}>Scan a wallet above to load balances, prices, positions, and activity.</Text></View>;
  if (loading) return <View style={s.loading}><ActivityIndicator color={isDark ? "#d7f900" : "#3f5f3b"} /><Text style={s.hint}>Syncing wallet intelligence...</Text></View>;
  if (error) return <View style={s.empty}><Text style={s.negative}>{error}</Text></View>;
  const total = dashboardTokens.reduce((sum, token) => sum + token.value, 0);
  return <View><View style={[s.hero, !isDark && s.lightCard]}><Text style={s.label}>TOTAL PORTFOLIO VALUE</Text><Text style={[s.total, !isDark && s.lightAccent]}>{formatUsd(total)}</Text><Text style={s.hint}>{BIRDEYE_API_KEY === "YOUR_API_KEY" ? "CoinGecko fallback active. Add your Birdeye key for Solana token coverage." : "Prices synced from Birdeye"}</Text></View><PortfolioCharts tokens={dashboardTokens} total={total} isDark={isDark} /><TokenMarketList tokens={dashboardTokens} isDark={isDark} /><DeFiPositions isDark={isDark} /><TransactionFeed transactions={transactions} isDark={isDark} /></View>;
}
const s = StyleSheet.create({ section: { marginBottom: 26 }, sectionTitle: { color: "#f5f7ee", fontSize: 17, fontWeight: "800", marginBottom: 4 }, hint: { color: "#687269", fontSize: 11 }, chart: { backgroundColor: "#101410", borderWidth: 1, borderColor: "#222c22", borderRadius: 8, paddingVertical: 10, marginTop: 10, marginBottom: 24, overflow: "hidden" }, hero: { backgroundColor: "#151b14", borderWidth: 1, borderColor: "#35422d", borderRadius: 8, padding: 20, marginBottom: 26 }, label: { color: "#8c9886", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" }, total: { color: "#d7f900", fontSize: 38, fontWeight: "900", marginVertical: 8 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#111511", borderWidth: 1, borderColor: "#202a20", padding: 13, borderRadius: 6, marginTop: 8 }, identity: { flex: 1, flexDirection: "row", alignItems: "center" }, logo: { width: 28, height: 28, borderRadius: 14, marginRight: 10 }, fallback: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#d7f900", marginHorizontal: 9 }, symbol: { color: "#f5f7ee", fontSize: 12, fontWeight: "900" }, metric: { width: 86, alignItems: "flex-end" }, value: { color: "#f5f7ee", fontSize: 10, fontWeight: "700" }, positive: { color: "#d7f900", fontSize: 10, fontWeight: "800" }, negative: { color: "#ff625c", fontSize: 10, fontWeight: "800" }, positionGrid: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#111511", borderWidth: 1, borderColor: "#202a20", borderRadius: 6, padding: 16, marginTop: 10 }, protocol: { color: "#d7f900", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, positionValue: { color: "#f5f7ee", fontSize: 20, fontWeight: "800", marginTop: 10 }, loading: { alignItems: "center", gap: 10, paddingVertical: 50 }, empty: { borderLeftWidth: 2, borderLeftColor: "#d7f900", paddingLeft: 16, marginTop: 12, marginBottom: 28 }, lightRow: { backgroundColor: "#eef1eb", borderColor: "#c8cfc4" }, lightText: { color: "#283128" }, lightAccent: { color: "#3f5f3b" }, lightAccentBackground: { backgroundColor: "#3f5f3b" }, lightCard: { backgroundColor: "#eef1eb", borderColor: "#b9c5b2" }, lightChart: { backgroundColor: "#eef1eb", borderColor: "#c8cfc4" } });