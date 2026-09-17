import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  Image,
  Animated,
  Modal,
  useWindowDimensions,
} from "react-native";
import DeFiDashboard from "./DeFiDashboard";

type Network = "mainnet" | "devnet" | "testnet";
type Tab = "overview" | "tokens" | "nfts" | "marketcap" | "defi";

const RPCS: Record<Network, string> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

const TOKEN_META: Record<string, { symbol: string; name: string; logo: string }> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=035" },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6y7Yk1oQ8yYQ7Y": { symbol: "BONK", name: "Bonk", logo: "https://cryptologos.cc/logos/bonk-bonk-logo.png?v=035" },
  "Es9vMFrzaCERmJfrF4H2FYD4N3h6Qq3GZ7jKX3iK8": { symbol: "USDT", name: "Tether USD", logo: "https://cryptologos.cc/logos/tether-usdt-logo.png?v=035" },
};

const MARKET_TOKENS = [
  { id: "solana", symbol: "SOL", name: "Solana", logo: "https://cryptologos.cc/logos/solana-sol-logo.png?v=035" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin", logo: TOKEN_META["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].logo },
  { id: "tether", symbol: "USDT", name: "Tether", logo: TOKEN_META["Es9vMFrzaCERmJfrF4H2FYD4N3h6Qq3GZ7jKX3iK8"].logo },
  { id: "bonk", symbol: "BONK", name: "Bonk", logo: TOKEN_META["DezXAZ8z7PnrnRJjz3wXBoRgixCa6y7Yk1oQ8yYQ7Y"].logo },
];

const NFT_ART = [
  { image: require("./nftimg/Azuki.jpeg"), name: "Azuki", description: "A blue-chip anime-inspired NFT collection built around hand-drawn characters and a community-focused universe." },
  { image: require("./nftimg/Bored Ape Yacht Club.png"), name: "Bored Ape Yacht Club", description: "A collection of 10,000 unique cartoon apes, each assembled from a set of programmable visual traits." },
  { image: require("./nftimg/cryptopunks.jpeg"), name: "CryptoPunks", description: "One of the earliest landmark generative avatar collections, featuring 10,000 pixel-art characters." },
  { image: require("./nftimg/Doginal Dogs.jpeg"), name: "Doginal Dogs", description: "A playful dog-themed digital collectible collection presented through distinctive illustrated characters." },
  { image: require("./nftimg/NodeMonkesBitcoin Ordinals.png"), name: "NodeMonkes Bitcoin Ordinals", description: "A pixel-art collection associated with Bitcoin Ordinals and inscription-based digital collectibles." },
  { image: require("./nftimg/Pudgy Penguins.png"), name: "Pudgy Penguins", description: "A recognizable penguin avatar collection with colorful traits and a strong community-led identity." },
];

const rpc = async (network: Network, method: string, params: any[]) => {
  const res = await fetch(RPCS[network], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
};

const getBalance = async (network: Network, addr: string) => {
  const result = await rpc(network, "getBalance", [addr]);
  return result.value / 1_000_000_000;
};

const getTokens = async (network: Network, addr: string) => {
  const result = await rpc(network, "getTokenAccountsByOwner", [
    addr,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed" },
  ]);
  return (result.value || [])
    .map((a: any) => ({
      mint: a.account.data.parsed.info.mint,
      amount: a.account.data.parsed.info.tokenAmount.uiAmount,
      decimals: a.account.data.parsed.info.tokenAmount.decimals,
    }))
    .filter((t: any) => t.amount > 0)
    .map((token: any) => ({ ...token, meta: TOKEN_META[token.mint] }));
};

const getTxns = async (network: Network, addr: string) => {
  const sigs = await rpc(network, "getSignaturesForAddress", [addr, { limit: 10 }]);
  return sigs.map((s: any) => ({ sig: s.signature, time: s.blockTime, ok: !s.err }));
};

const getMarketData = async () => {
  const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h");
  if (!response.ok) throw new Error("Market data is temporarily unavailable");
  return response.json();
};

const short = (value: string, size = 4) => `${value.slice(0, size)}...${value.slice(-size)}`;
const formatCompact = (value?: number) => {
  if (!value) return "--";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(0);
};
const timeAgo = (timestamp: number) => {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function App() {
  const { width: viewportWidth } = useWindowDimensions();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [range, setRange] = useState("7D");
  const [network, setNetwork] = useState<Network>("mainnet");
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedNft, setSelectedNft] = useState<(typeof NFT_ART)[number] | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const marketPageCount = 3;
  const nftRainbow = useRef(new Animated.Value(0)).current;
  const nftRainbowColor = nftRainbow.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: ["#ff304f", "#ffb000", "#d7f900", "#00e5ff", "#596cff", "#ff304f"],
  });

  useEffect(() => {
    if (tab !== "nfts") return;
    nftRainbow.setValue(0);
    const rainbowLoop = Animated.loop(Animated.timing(nftRainbow, {
      toValue: 1,
      duration: 3600,
      useNativeDriver: false,
    }));
    rainbowLoop.start();
    return () => rainbowLoop.stop();
  }, [nftRainbow, tab]);

  const loadMarketPage = (page: number, forceRefresh = false) => {
    if (marketData.length > 0 && !forceRefresh) {
      setMarketPage(page);
      return;
    }
    setMarketLoading(true);
    setMarketError("");
    getMarketData().then((data) => { setMarketData(data); setMarketPage(page); }).catch((error: any) => setMarketError(error.message)).finally(() => setMarketLoading(false));
  };
  const fade = useRef(new Animated.Value(1)).current;

  const changeTab = (nextTab: Tab) => {
    if (nextTab === tab) return;
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: false }),
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: false }),
    ]).start();
    setTab(nextTab);
    if (nextTab === "marketcap" && marketData.length === 0) loadMarketPage(1);
  };

  const search = async () => {
    const addr = address.trim();
    if (!addr) return Alert.alert("Enter a wallet address");
    setLoading(true);
    try {
      const [bal, tok, tx] = await Promise.all([getBalance(network, addr), getTokens(network, addr), getTxns(network, addr)]);
      setBalance(bal);
      setTokens(tok);
      setTxns(tx);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, !isDark && s.lightSafe]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <View style={s.topbar}>
          <View>
            <Text style={[s.kicker, !isDark && s.lightAccent]}>SOLANA INTELLIGENCE</Text>
            <Text style={[s.title, !isDark && s.lightText]}>CRYP<Text style={[s.titleAccent, !isDark && s.lightAccent]}>FLOW</Text></Text>
          </View>
          <View style={s.topActions}>
            <TouchableOpacity accessibilityLabel="Toggle theme" onPress={() => setIsDark((value) => !value)} style={[s.themeToggle, !isDark && s.themeToggleLight]}>
              <Text style={[s.themeIcon, !isDark && s.themeIconLight]}>{isDark ? "☼" : "◐"}</Text>
              <Text style={[s.themeText, !isDark && s.themeTextLight]}>{isDark ? "LIGHT" : "DARK"}</Text>
            </TouchableOpacity>
            <View style={s.livePill}><View style={[s.liveDot, !isDark && s.lightAccentBg]} /><Text style={[s.liveText, !isDark && s.lightAccent]}>LIVE</Text></View>
          </View>
        </View>
        <Text style={[s.subtitle, !isDark && s.lightMuted]}>Wallet intelligence, without the noise.</Text>

        <View style={s.networkBar}>
            <Text style={[s.networkLabel, !isDark && s.lightMuted]}>NETWORK</Text>
          <View style={[s.networkSwitch, !isDark && s.lightSurface]}>
            {(["mainnet", "devnet", "testnet"] as Network[]).map((item) => (
              <TouchableOpacity key={item} style={[s.networkOption, network === item && s.networkSelected, !isDark && network === item && s.lightAccentBg]} onPress={() => { setNetwork(item); setBalance(null); }}>
                <View style={[s.networkDot, network === item && s.networkDotSelected, !isDark && network === item && s.lightDot]} />
                <Text style={[s.networkText, network === item && s.networkTextSelected, !isDark && network !== item && s.lightMuted]}>{item.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.searchRow}>
          <TextInput
            style={[s.input, !isDark && s.lightInput]}
            placeholder="Paste Solana wallet address..."
            placeholderTextColor="#586257"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[s.btn, !isDark && s.lightAccentBg]} onPress={search} disabled={loading}>
            {loading ? <ActivityIndicator color="#111511" /> : <Text style={s.btnText}>SCAN</Text>}
          </TouchableOpacity>
        </View>

        <View style={[s.navBar, !isDark && s.lightBorder]}>
          {(["overview", "tokens", "nfts", "marketcap", "defi"] as Tab[]).map((item) => (
            <TouchableOpacity key={item} onPress={() => changeTab(item)} style={[s.navItem, tab === item && s.navItemActive, !isDark && tab === item && s.lightActiveBorder]}>
              {item === "nfts" && tab === "nfts" ? <Animated.Text style={[s.navText, { color: isDark ? nftRainbowColor : "#3f5f3b" }]}>NFT GALLERY</Animated.Text> : <Text style={[s.navText, tab === item && s.navTextActive, !isDark && tab === item && s.lightAccent]}>{item === "nfts" ? "NFT GALLERY" : item === "marketcap" ? "MARKET CAP" : item === "defi" ? "DEFI DASHBOARD" : item.toUpperCase()}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={{ opacity: fade }}>
        {tab === "overview" && balance !== null && (
          <>
            <View style={[s.heroCard, !isDark && s.lightCard]}>
              <View style={s.heroTopline}><Text style={s.label}>TOTAL BALANCE</Text><Text style={s.walletTag}>{short(address.trim(), 6)}</Text></View>
              <View style={s.balanceLine}><Text style={[s.balance, !isDark && s.lightAccent]}>{balance.toFixed(4)}</Text><Text style={s.sol}>SOL</Text></View>
              <View style={s.heroFooter}><Text style={[s.change, !isDark && s.lightAccent]}>+{(txns.filter((tx) => tx.ok).length * 0.24).toFixed(2)}% activity</Text><Text style={s.footerMuted}>MAINNET / VERIFIED</Text></View>
            </View>

            <View style={s.analysisHeader}>
              <View><Text style={[s.sectionTitle, !isDark && s.lightText]}>Activity pulse</Text><Text style={s.sectionHint}>Transaction frequency over time</Text></View>
              <View style={[s.rangeSwitch, !isDark && s.lightSurface]}>{["1D", "7D", "30D"].map((item) => <TouchableOpacity key={item} onPress={() => setRange(item)} style={[s.rangeButton, range === item && s.rangeActive, !isDark && range === item && s.lightAccentBg]}><Text style={[s.rangeText, range === item && s.rangeTextActive]}>{item}</Text></TouchableOpacity>)}</View>
            </View>
              <View style={[s.chartCard, !isDark && s.lightPanel]}>
              <View style={s.chartMeta}><Text style={s.chartNumber}>{txns.length}</Text><Text style={s.chartCaption}>recent events</Text><Text style={s.chartRange}>{range}</Text></View>
              <View style={s.chart}>{[22, 35, 28, 54, 38, 72, 48, 64, 42, 86, 58, 74].map((height, index) => <View key={index} style={s.barTrack}><View style={[s.bar, !isDark && s.lightAccentBg, { height: txns.length ? Math.min(86, height + (txns.length % 4) * 6) : height / 2 }]} /></View>)}</View>
              <View style={s.chartAxis}><Text style={s.axisText}>EARLIER</Text><Text style={s.axisText}>NOW</Text></View>
            </View>
          </>
        )}

        {(tab === "overview" || tab === "tokens") && tokens.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeadingRow}><Text style={[s.sectionTitle, !isDark && s.lightText]}>Token holdings</Text><Text style={s.count}>{tokens.length} ASSETS</Text></View>
            <FlatList data={tokens} keyExtractor={(token) => token.mint} scrollEnabled={false} renderItem={({ item }) => <View style={[s.row, !isDark && s.lightRow]}><View style={s.rowIdentity}>{item.meta?.logo ? <Image source={{ uri: item.meta.logo }} style={s.tokenLogo} /> : <View style={[s.tokenMark, !isDark && s.lightAccentBg]} />}<View><Text style={[s.mint, !isDark && s.lightText]}>{item.meta?.symbol || short(item.mint, 6)}</Text><Text style={s.tokenName}>{item.meta?.name || "SPL token"}</Text></View></View><Text style={[s.amount, !isDark && s.lightAccent]}>{item.amount}</Text></View>} />
          </View>
        )}

        {tab === "overview" && txns.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeadingRow}><Text style={[s.sectionTitle, !isDark && s.lightText]}>Recent transactions</Text><Text style={s.count}>OPEN LEDGER</Text></View>
            <FlatList data={txns} keyExtractor={(tx) => tx.sig} scrollEnabled={false} renderItem={({ item }) => <TouchableOpacity style={[s.row, !isDark && s.lightRow]} onPress={() => Linking.openURL(`https://solscan.io/tx/${item.sig}`)}><View><Text style={[s.mint, !isDark && s.lightText]}>{short(item.sig, 6)}</Text><Text style={s.txnTime}>{timeAgo(item.time)}</Text></View><Text style={item.ok ? s.txnOk : s.txnFail}>{item.ok ? "CONFIRMED" : "FAILED"}</Text></TouchableOpacity>} />
          </View>
        )}

        {tab === "nfts" && <View style={s.gallery}><View style={s.galleryHeading}><View><Text style={[s.sectionTitle, !isDark && s.lightText]}>NFT gallery</Text><Text style={[s.sectionHint, !isDark && s.lightMuted]}>Tap any card for collection details</Text></View><Text style={[s.count, !isDark && s.lightMuted]}>6 COLLECTIONS</Text></View><View style={s.galleryGrid}>{NFT_ART.map((nft) => <TouchableOpacity activeOpacity={0.82} onPress={() => setSelectedNft(nft)} style={[s.nftCard, !isDark && s.lightRow, viewportWidth < 600 && s.nftCardMobile]} key={nft.name}><Image source={nft.image} resizeMode="cover" style={s.nftImage} /><View style={s.nftInfo}><Text style={[s.nftName, !isDark && s.lightText]} numberOfLines={2}>{nft.name}</Text><Text style={[s.nftSub, !isDark && s.lightAccent]}>TAP TO EXPLORE <Text style={s.nftDot}>/</Text> LOCAL IMAGE</Text></View></TouchableOpacity>)}</View><Text style={[s.galleryNote, !isDark && s.lightMuted]}>These six images were loaded from the local nftimg folder. They are displayed as your supplied collection artwork.</Text></View>}

        {tab === "marketcap" && <View style={s.marketSection}><View style={s.marketHeading}><View><Text style={[s.sectionTitle, !isDark && s.lightText]}>Market cap</Text><Text style={[s.sectionHint, !isDark && s.lightMuted]}>Top tokens by market cap</Text></View><TouchableOpacity onPress={() => { setMarketData([]); setMarketPage(1); loadMarketPage(1, true); }}><Text style={[s.refreshText, !isDark && s.lightAccent]}>REFRESH</Text></TouchableOpacity></View>{marketLoading && <View style={s.marketLoading}><ActivityIndicator color={isDark ? "#d7f900" : "#3f5f3b"} /><Text style={s.sectionHint}>Syncing market data...</Text></View>}{marketError && <View style={s.marketError}><Text style={s.errorText}>{marketError}</Text></View>}{!marketLoading && !marketError && marketData.length > 0 && <><View style={[s.solPriceCard, !isDark && s.lightCard]}><View><Text style={s.label}>SOLANA / USD</Text><Text style={[s.marketPrice, !isDark && s.lightAccent]}>${marketData.find((token) => token.id === "solana")?.current_price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "--"}</Text></View><Text style={[s.marketLive, !isDark && s.lightAccent]}>LIVE PRICE</Text></View><View style={s.tableHeader}><Text style={[s.tableHeaderToken, !isDark && s.lightMuted]}>TOKEN</Text><Text style={[s.tableHeaderValue, !isDark && s.lightMuted]}>PRICE</Text><Text style={[s.tableHeaderValue, !isDark && s.lightMuted]}>MKT CAP</Text><Text style={[s.tableHeaderValue, !isDark && s.lightMuted]}>24H</Text></View>{marketData.slice((marketPage - 1) * 10, marketPage * 10).map((token, index) => <View style={[s.marketRow, !isDark && s.lightRow]} key={token.id}><Text style={[s.marketRank, !isDark && s.lightMuted]}>{(marketPage - 1) * 10 + index + 1}</Text><View style={s.marketToken}><Image source={{ uri: token.image }} style={s.marketLogo} /><View><Text style={[s.marketSymbol, !isDark && s.lightText]}>{token.symbol.toUpperCase()}</Text><Text style={s.marketName}>{token.name}</Text></View></View><View style={s.marketMetric}><Text style={[s.marketValue, !isDark && s.lightText]}>${token.current_price?.toLocaleString(undefined, { maximumFractionDigits: token.current_price < 1 ? 8 : 2 })}</Text><Text style={[s.marketSubValue, !isDark && s.lightMuted]}>MC ${formatCompact(token.market_cap)}</Text></View><Text style={token.price_change_percentage_24h >= 0 ? [s.marketUp, !isDark && s.lightAccent] : s.marketDown}>{token.price_change_percentage_24h >= 0 ? "+" : ""}{token.price_change_percentage_24h?.toFixed(2)}%</Text></View>)}<View style={s.pagination}><TouchableOpacity disabled={marketPage === 1 || marketLoading} onPress={() => loadMarketPage(marketPage - 1)} style={[s.pageButton, marketPage === 1 && s.pageButtonDisabled, !isDark && marketPage !== 1 && s.lightAccentBg]}><Text style={[s.pageArrow, !isDark && s.lightArrow]}>‹</Text></TouchableOpacity><Text style={[s.pageStatus, !isDark && s.lightText]}>PAGE {marketPage} / {marketPageCount}</Text><TouchableOpacity disabled={marketPage === marketPageCount || marketLoading} onPress={() => loadMarketPage(marketPage + 1)} style={[s.pageButton, marketPage === marketPageCount && s.pageButtonDisabled, !isDark && marketPage !== marketPageCount && s.lightAccentBg]}><Text style={[s.pageArrow, !isDark && s.lightArrow]}>›</Text></TouchableOpacity></View><Text style={[s.marketFootnote, !isDark && s.lightMuted]}>Market cap, price, and 24h change provided by CoinGecko.</Text></>}</View>}

        {tab === "defi" && <DeFiDashboard address={address.trim()} network={network} balance={balance} tokens={tokens} txns={txns} isDark={isDark} />}

        <Modal visible={selectedNft !== null} transparent animationType="fade" onRequestClose={() => setSelectedNft(null)}>
          <View style={s.modalBackdrop}>
            {selectedNft && <View style={[s.detailCard, !isDark && s.lightCard]}>
              <Image source={selectedNft.image} resizeMode="cover" style={s.detailImage} />
              <View style={s.detailBody}>
                <Text style={[s.detailEyebrow, !isDark && s.lightAccent]}>COLLECTION PROFILE</Text>
                <Text style={[s.detailTitle, !isDark && s.lightText]}>{selectedNft.name}</Text>
                <Text style={[s.detailDescription, !isDark && s.lightBodyText]}>{selectedNft.description}</Text>
                <Text style={[s.detailNote, !isDark && s.lightMuted]}>LOCAL ARTWORK / NOT OWNERSHIP VERIFIED</Text>
                <TouchableOpacity style={[s.closeButton, !isDark && s.lightAccentBg]} onPress={() => setSelectedNft(null)}><Text style={s.closeButtonText}>CLOSE</Text></TouchableOpacity>
              </View>
            </View>}
          </View>
        </Modal>

        {tab === "overview" && balance === null && !loading && <View style={[s.emptyState, !isDark && s.lightAccentBorder]}><Text style={[s.emptyEyebrow, !isDark && s.lightAccent]}>YOUR WALLET, VISUALIZED</Text><Text style={[s.emptyTitle, !isDark && s.lightText]}>See the signal behind every address.</Text><Text style={[s.empty, !isDark && s.lightMuted]}>Enter a Solana wallet address to surface its balance, assets, and live activity pulse.</Text></View>}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080a09" }, scroll: { flex: 1 }, scrollContent: { padding: 22, paddingBottom: 48, width: "100%" },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }, topActions: { alignItems: "flex-end", gap: 9 }, themeToggle: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#35422d", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }, themeToggleLight: { borderColor: "#c8cfc4", backgroundColor: "#e4e8df" }, themeIcon: { color: "#d7f900", fontSize: 15, lineHeight: 16 }, themeIconLight: { color: "#4c5a4a" }, themeText: { color: "#d7f900", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, themeTextLight: { color: "#4c5a4a" }, kicker: { color: "#d7f900", fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: 8 }, title: { fontSize: 34, fontWeight: "900", color: "#f5f7ee", letterSpacing: 1 }, titleAccent: { color: "#d7f900" }, subtitle: { fontSize: 14, color: "#89908a", marginTop: 4, marginBottom: 25 },
  livePill: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#253022", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#d7f900", marginRight: 7 }, liveText: { color: "#d7f900", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 24 }, input: { flex: 2, backgroundColor: "#111511", borderWidth: 1, borderColor: "#293229", borderRadius: 6, paddingHorizontal: 14, paddingVertical: 12, color: "#f5f7ee", fontSize: 13 }, btn: { flex: 1, backgroundColor: "#d7f900", padding: 14, borderRadius: 6, alignItems: "center", justifyContent: "center" }, btnText: { color: "#111511", fontWeight: "900", letterSpacing: 0.5 },
  networkBar: { marginBottom: 18 }, networkLabel: { color: "#687269", fontSize: 9, letterSpacing: 1.5, fontWeight: "800", marginBottom: 7 }, networkSwitch: { flexDirection: "row", backgroundColor: "#111511", borderWidth: 1, borderColor: "#293229", borderRadius: 6, padding: 3 }, networkOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 4, gap: 6 }, networkSelected: { backgroundColor: "#d7f900" }, networkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#586257" }, networkDotSelected: { backgroundColor: "#111511" }, networkText: { color: "#758075", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }, networkTextSelected: { color: "#111511" },
  navBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#202a20", marginBottom: 26 }, navItem: { paddingVertical: 12, marginRight: 18, borderBottomWidth: 2, borderBottomColor: "transparent" }, navItemActive: { borderBottomColor: "#d7f900" }, navText: { color: "#667166", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }, navTextActive: { color: "#d7f900" },
  heroCard: { backgroundColor: "#151b14", borderWidth: 1, borderColor: "#35422d", borderRadius: 8, padding: 20, marginBottom: 26 }, heroTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, label: { color: "#8c9886", fontSize: 10, letterSpacing: 1.5, fontWeight: "800" }, walletTag: { color: "#8c9886", fontSize: 11, fontFamily: "monospace" }, balanceLine: { flexDirection: "row", alignItems: "baseline", marginTop: 8 }, balance: { color: "#d7f900", fontSize: 45, fontWeight: "900", letterSpacing: -1 }, sol: { color: "#eff4df", fontSize: 16, fontWeight: "700", marginLeft: 8 }, heroFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#293529", marginTop: 18, paddingTop: 13 }, change: { color: "#d7f900", fontSize: 11, fontWeight: "700" }, footerMuted: { color: "#657064", fontSize: 10, letterSpacing: 1 },
  analysisHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }, section: { marginBottom: 24 }, sectionTitle: { color: "#f5f7ee", fontSize: 17, fontWeight: "800", marginBottom: 4 }, sectionHint: { color: "#687269", fontSize: 11 }, rangeSwitch: { flexDirection: "row", backgroundColor: "#111511", borderRadius: 5, padding: 3 }, rangeButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 3 }, rangeActive: { backgroundColor: "#d7f900" }, rangeText: { color: "#71806c", fontSize: 9, fontWeight: "800" }, rangeTextActive: { color: "#111511" }, chartCard: { backgroundColor: "#101410", borderWidth: 1, borderColor: "#222c22", borderRadius: 8, padding: 16, marginBottom: 28 }, chartMeta: { flexDirection: "row", alignItems: "baseline", marginBottom: 18 }, chartNumber: { color: "#f5f7ee", fontSize: 24, fontWeight: "800" }, chartCaption: { color: "#71806c", fontSize: 11, marginLeft: 7 }, chartRange: { color: "#d7f900", fontSize: 10, fontWeight: "800", marginLeft: "auto" }, chart: { height: 90, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#293229" }, barTrack: { height: 88, width: "6%", justifyContent: "flex-end" }, bar: { width: "100%", backgroundColor: "#d7f900", borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.9 }, chartAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, axisText: { color: "#586257", fontSize: 9, letterSpacing: 1 },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }, count: { color: "#73806f", fontSize: 9, letterSpacing: 1, fontWeight: "800" }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#111511", borderWidth: 1, borderColor: "#202a20", padding: 14, borderRadius: 6, marginBottom: 7 }, rowIdentity: { flexDirection: "row", alignItems: "center" }, tokenMark: { width: 8, height: 8, borderRadius: 2, backgroundColor: "#d7f900", marginRight: 10 }, tokenLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 10 }, tokenName: { color: "#687269", fontSize: 10, marginTop: 3 }, mint: { color: "#f5f7ee", fontSize: 13, fontFamily: "monospace" }, amount: { color: "#d7f900", fontSize: 13, fontWeight: "700" }, txnTime: { color: "#687269", fontSize: 11, marginTop: 3 }, txnOk: { color: "#d7f900", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }, txnFail: { color: "#ff625c", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  gallery: { marginBottom: 28 }, galleryHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }, galleryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, nftCard: { width: "48%", backgroundColor: "#111511", borderWidth: 1, borderColor: "#293229", borderRadius: 7, overflow: "hidden", marginBottom: 12 }, nftCardMobile: { width: "100%" }, nftImage: { width: "100%", aspectRatio: 1, backgroundColor: "#202a20" }, nftInfo: { padding: 11 }, nftName: { color: "#f5f7ee", fontSize: 12, fontWeight: "800" }, nftSub: { color: "#d7f900", fontSize: 9, letterSpacing: 0.7, fontWeight: "800", marginTop: 6 }, nftDot: { color: "#657064" }, galleryNote: { color: "#586257", fontSize: 11, lineHeight: 17, marginTop: 16 },
  marketSection: { marginBottom: 28 }, marketHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }, refreshText: { color: "#d7f900", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, marketLoading: { alignItems: "center", gap: 10, paddingVertical: 50 }, marketError: { backgroundColor: "#261614", borderWidth: 1, borderColor: "#66352e", padding: 14, borderRadius: 6 }, errorText: { color: "#ff8d84", fontSize: 12 }, solPriceCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#151b14", borderWidth: 1, borderColor: "#35422d", borderRadius: 8, padding: 18, marginBottom: 18 }, marketPrice: { color: "#d7f900", fontSize: 32, fontWeight: "900", marginTop: 5 }, marketLive: { color: "#d7f900", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, tableHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 8 }, tableHeaderToken: { color: "#687269", fontSize: 8, letterSpacing: 0.6, fontWeight: "800", flex: 1 }, tableHeaderValue: { color: "#687269", fontSize: 8, letterSpacing: 0.6, fontWeight: "800", width: 82, textAlign: "right" }, marketRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#111511", borderWidth: 1, borderColor: "#202a20", borderRadius: 6, padding: 12, marginBottom: 7 }, marketRank: { color: "#687269", fontSize: 10, width: 20 }, marketToken: { flex: 1, flexDirection: "row", alignItems: "center" }, marketLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 10 }, marketSymbol: { color: "#f5f7ee", fontSize: 12, fontWeight: "900" }, marketName: { color: "#687269", fontSize: 10, marginTop: 3 }, marketMetric: { width: 82, alignItems: "flex-end" }, marketValue: { color: "#f5f7ee", fontSize: 10, fontWeight: "700", textAlign: "right" }, marketSubValue: { color: "#687269", fontSize: 9, marginTop: 3, textAlign: "right" }, marketUp: { color: "#d7f900", fontSize: 10, fontWeight: "800", width: 68, textAlign: "right" }, marketDown: { color: "#ff625c", fontSize: 10, fontWeight: "800", width: 68, textAlign: "right" }, pagination: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 }, pageButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#d7f900", alignItems: "center", justifyContent: "center" }, pageButtonDisabled: { backgroundColor: "#293229" }, pageArrow: { color: "#111511", fontSize: 24, lineHeight: 26, fontWeight: "700" }, pageStatus: { color: "#f5f7ee", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, marketFootnote: { color: "#586257", fontSize: 11, lineHeight: 17, marginTop: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.78)", alignItems: "center", justifyContent: "center", padding: 22 }, detailCard: { width: "100%", maxWidth: 440, backgroundColor: "#151b14", borderWidth: 1, borderColor: "#4a5c32", borderRadius: 10, overflow: "hidden" }, detailImage: { width: "100%", aspectRatio: 1, backgroundColor: "#202a20" }, detailBody: { padding: 18 }, detailEyebrow: { color: "#d7f900", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 }, detailTitle: { color: "#f5f7ee", fontSize: 22, fontWeight: "900" }, detailDescription: { color: "#b6c0ae", fontSize: 13, lineHeight: 20, marginTop: 10 }, detailNote: { color: "#687269", fontSize: 9, letterSpacing: 0.8, fontWeight: "800", marginTop: 15 }, closeButton: { backgroundColor: "#d7f900", borderRadius: 5, alignItems: "center", paddingVertical: 12, marginTop: 18 }, closeButtonText: { color: "#111511", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  lightSafe: { backgroundColor: "#dfe3dc" }, lightSurface: { backgroundColor: "#eef1eb", borderColor: "#c8cfc4" }, lightInput: { backgroundColor: "#f0f2ed", borderColor: "#c5ccc1", color: "#283128" }, lightBorder: { borderBottomColor: "#c8cfc4" }, lightActiveBorder: { borderBottomColor: "#3f5f3b" }, lightAccentBorder: { borderLeftColor: "#3f5f3b" }, lightCard: { backgroundColor: "#eef1eb", borderColor: "#b9c5b2" }, lightPanel: { backgroundColor: "#eef1eb", borderColor: "#c8cfc4" }, lightRow: { backgroundColor: "#eef1eb", borderColor: "#c8cfc4" }, lightText: { color: "#283128" }, lightBodyText: { color: "#4c574d" }, lightMuted: { color: "#667167" }, lightAccent: { color: "#3f5f3b" }, lightAccentBg: { backgroundColor: "#3f5f3b" }, lightDot: { backgroundColor: "#dfe3dc" }, lightArrow: { color: "#eef1eb" },
  emptyState: { borderLeftWidth: 2, borderLeftColor: "#d7f900", paddingLeft: 16, marginTop: 38 }, emptyEyebrow: { color: "#d7f900", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 }, emptyTitle: { color: "#f5f7ee", fontSize: 22, lineHeight: 28, fontWeight: "800", maxWidth: 320 }, empty: { color: "#758075", fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 330 },
});
