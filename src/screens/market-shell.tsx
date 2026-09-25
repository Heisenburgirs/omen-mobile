import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
// Height changes inside the trade dock animate on the old Android architecture too.
if (Platform.OS === "android")
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
import {
  OmenDialog,
  OmenSheet,
  type SheetContent,
  type SheetAction,
} from "../components/omen-sheet";
import { WebView } from "../components/web-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrivy } from "../lib/privy";
import { AgentScreen } from "./agent";
import { isAddress } from "@solana/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "../lib/secure-store";
import QRCode from "react-native-qrcode-styled";
import {
  tradingColors as colors,
  tradingFonts as fonts,
  space,
  radius,
} from "../theme";
import {
  OmenNavigation,
  OMEN_TABS,
  type OmenTab as Tab,
} from "../components/omen-navigation";
import { RaisedButton as Button } from "../components/raised-button";
import { Mark } from "../components/ui";
import { AccountConnections } from "../components/account-connections";
import { WalletsSection, walletName } from "../components/wallets-section";
import { RaisedButton } from "../components/raised-button";
import { WalletDrawer, type WalletEntry, type WalletScope } from "../components/wallet-drawer";
import type { WalletInfo } from "../lib/chain-actions";
import {
  m,
  SkeletonRows,
  Skeleton,
  SkeletonTiles,
  Icon,
  type IconName,
  IconButton,
  Chip,
  Field,
  avatarColor,
  Section,
  Empty,
  LoadState,
  AssetRow,
  CashRow,
  PersonRow,
  AssetIcon,
  SlideToConfirm,
  Dots,
  Dropdown,
  ScreenTransition,
  TabFade,
} from "../components/market-ui";
import { PriceChart } from "../components/price-chart";
import {
  DividendChart,
  type DividendPoint,
} from "../components/dividend-chart";
import { LaunchScreen } from "../components/launch-screen";
import { BlurView } from "expo-blur";
import { config } from "../config";
import {
  useChainActions,
  errorMessage,
  splitAcrossWallets,
  walletHolding,
  type Quote,
} from "../lib/chain-actions";

/** A yes/no dialog as a promise, for consent prompts inside async flows. */
import {
  useMobile,
  useMobileAction,
  mobileFetch,
  usePrefetchMobile,
} from "../lib/mobile-api";
import { useStableOrder } from "../lib/stable-order";
import { Animated, Easing, type TextInput, type TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { chartPrefs, loadChartPrefs, saveChartPrefs } from "../lib/chart-prefs";
import { periodChange, formatApr } from "../domain/market";
import { showToast } from "../lib/toast";
import { playSound, preloadSounds } from "../lib/sound";
import { LinearGradient } from "expo-linear-gradient";
// The saved chart timeframe and style are ready before any token page opens.
void loadChartPrefs();
const assetKey = (asset: Asset) => asset.mint;
/** The payout token card: panel padding, a 22 px title row, 6 px gap, a 28 px icon row. */
const PAYERS_CARD_HEIGHT = 16 + 22 + 6 + 28 + 16 + 2;
/** A watchlist tile's height: 12 px padding, a 20 px row, 6 px gap, a 24 px row, 12 px padding, 1 px borders. */
const TILE_HEIGHT = 76;
import { showErrorToast } from "../lib/toast";
import { shortAddress } from "../lib/balance";
import {
  usd,
  tokenQty as formatTokenQty,
  assetPrice,
  pct,
  safeUrl,
  stonkApr,
  measuredApr,
  aprBasis,
  assetSortMetric,
} from "../domain/market";
import {
  emptyAsset,
  SOL,
  USDC,
  CASH_MINTS,
  isCash,
  TZ,
  type DripRecord,
  type SortDirection,
} from "../domain/models";
import type {
  Activity,
  Asset,
  AssetStats,
  Candle,
  Envelope,
  Filters,
  Holding,
  Period,
  Portfolio,
  Profile,
} from "../domain/models";
export type MarketShellProps = {
  /** The signed-in wallet; empty for a visitor looking around before signing in. */
  address: string;
  /** Visitors only: leave the look-around and go to sign-in. */
  onRequestSignIn?: () => void;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  sessionError?: string;
};
type Route =
  | { type: "browser"; url: string }
  | { type: "asset"; mint: string }
  | { type: "profile"; id: string }
  | {
      type: "activity" | "dividends" | "portfolio";
      address?: string;
      mint?: string;
      symbol?: string;
      /** For dividends: the token that pays them (source) or the token they are paid in. */
      role?: "source" | "payout";
    }
  | { type: "dripDetail"; row: Activity }
  | {
      type: "drip";
      kind: "drip" | "drip-from";
      mint: string;
      symbol: string;
      payout: string;
      payoutSymbol: string;
    }
  | { type: "onboarding" }
  | {
      type: "receive" | "send" | "settings" | "edit" | "blocked" | "watchlist";
      /** Withdraw opens on this asset, e.g. cash from the cash page. */
      mint?: string;
    }
  | { type: "relations"; id: string; direction: "followers" | "following" };
/** The smallest buy or sell, in dollars; `lib/mobile/handler.ts` enforces the same. */
const MIN_TRADE_USD = 1;
const Context = createContext<any>(null);
const useApp = () => useContext(Context);
function Page({
  children,
  refresh,
  compact = false,
  onEndReached,
  bottomInset = 0,
  scrollEnabled = true,
  innerRef,
}: {
  children: React.ReactNode;
  refresh?: () => Promise<unknown>;
  /** The scroll view itself, for a screen that must scroll a field into view. */
  innerRef?: React.RefObject<ScrollView | null>;
  compact?: boolean;
  /** Called when the scroll position nears the end of the content. */
  onEndReached?: () => void;
  /** Extra bottom padding so a floating dock never covers the last item. */
  bottomInset?: number;
  /** False while a child owns the touch (chart scrubbing): the page holds still. */
  scrollEnabled?: boolean;
}) {
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = async () => {
    if (!refresh || pulling) return;
    setPulling(true);
    try {
      await refresh();
    } catch {
      showErrorToast("Could not refresh. Please try again.");
    } finally {
      setPulling(false);
    }
  };
  return (
    <ScrollView
      ref={innerRef}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={200}
      onScroll={
        onEndReached
          ? (e) => {
              const { contentOffset, layoutMeasurement, contentSize } =
                e.nativeEvent;
              if (
                contentOffset.y + layoutMeasurement.height >=
                contentSize.height - 480
              )
                onEndReached();
            }
          : undefined
      }
      contentContainerStyle={[
        m.page,
        compact && { gap: space.lg },
        bottomInset ? { paddingBottom: space.xl + bottomInset } : null,
      ]}
      refreshControl={
        refresh ? (
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void pullToRefresh()}
            tintColor={colors.mist}
            colors={[colors.focus]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
export function MarketShell(props: MarketShellProps) {
  const { user, getAccessToken } = usePrivy();
  // A visitor (web, before sign-in) gets the market: search, token pages and
  // charts are public. Anything that needs an account asks them to sign in.
  const guest = !props.address;
  const [tab, setTabState] = useState<Tab>(guest ? "Search" : "Home"),
    [routes, setRoutes] = useState<Route[]>([]),
    [hidden, setHidden] = useState(false),
    [locked, setLocked] = useState(false);
  const [sheetContent, setSheetContent] = useState<SheetContent | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const dialog = (title: string, body?: string, actions?: SheetAction[]) => {
    setSheetContent({ title, body, actions });
    setSheetVisible(true);
  };
  const askSignIn = () =>
    dialog("Sign in to continue", undefined, [
      { text: "Sign in", onPress: () => props.onRequestSignIn?.() },
    ]);
  const setTab = (t: Tab) =>
    guest && t !== "Search" ? askSignIn() : setTabState(t);
  const act = useMobileAction();
  // What the app shows: the whole book ("all") or one wallet, chosen in
  // the switcher behind the profile at the top of Home. The server reads
  // the book for "all" and the one wallet otherwise; a buy made while a
  // wallet is chosen lands in it.
  const [scope, setScope] = useState<WalletScope>("all");
  const [walletsOpen, setWalletsOpen] = useState(false);
  const [importPending, setImportPending] = useState(false);
  // A token whose page should open its buy dock on arrival (the empty
  // dividends page's "Buy X" goes back to it).
  const [pendingBuy, setPendingBuy] = useState<string | null>(null);
  const positions = useMobile<Portfolio>(
    "portfolio",
    { address: guest ? props.address : scope, tz: TZ },
    true,
    20000,
  );
  // Every wallet with its name, whatever the scope; values from the book
  // where the book covers them.
  const walletsQuery = useMobile<WalletInfo[]>("wallets", {}, !guest, 30000);
  const wallets: WalletEntry[] = (walletsQuery.data?.data ?? []).map((w) => {
    const known = positions.data?.data.wallets?.find((x) => x.address === w.address);
    return { ...w, totalUsd: known?.totalUsd, nativeLamports: known?.nativeLamports };
  });
  const scopeIndex = wallets.findIndex((w) => w.address === scope);
  const scopeLabel =
    scope === "all" ? null : walletName(wallets[scopeIndex] ?? { primary: false, imported: true }, Math.max(1, scopeIndex));
  const me = useQuery({
    queryKey: ["mobile", user?.id, "me"],
    queryFn: async ({ signal }) =>
      mobileFetch<Profile>(
        "me",
        {},
        await getAccessToken(),
        signal,
        "POST",
        {},
      ),
    enabled: !guest,
    retry: false,
    staleTime: 60000,
    // The profile follows the X link on the server; a minute is the most
    // the app shows an older name or picture without being asked.
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  // Fetched at once rather than after the profile, so the Home tiles are
  // not the last thing to arrive; a brand-new profile (404 until `me`
  // creates it) is retried once the profile exists.
  const watches = useMobile<string[]>("watchlist", {}, true, 0);
  useEffect(() => {
    if (me.data && watches.isError) void watches.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);
  // A popped screen stays mounted while it slides out; `closing` marks it.
  const [closing, setClosing] = useState(false);
  const nav = (r: Route) => {
    // A visitor can open a token or a page of the site; the rest is an account's.
    if (guest && r.type !== "asset" && r.type !== "browser") return askSignIn();
    setClosing(false);
    setRoutes((rs) => [...rs, r]);
    // In a browser every screen is a history entry, so the browser's Back
    // (and Android's back gesture in the installed web app) closes the
    // screen instead of leaving OMEN.
    if (Platform.OS === "web") window.history.pushState({ omen: true }, "");
  };
  const pop = () => {
    if (!locked && routes.length && !closing) setClosing(true);
  };
  const popRef = useRef(pop);
  popRef.current = pop;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onPop = () => {
      // A flow that must not be left half-way (a send in flight) keeps its entry.
      if (lockedRef.current) window.history.pushState({ omen: true }, "");
      else popRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // The app's own back arrow goes through the same history entry on web.
  const back = () =>
    Platform.OS === "web" && routes.length ? window.history.back() : pop();
  const finishClose = () => {
    setRoutes((rs) => rs.slice(0, -1));
    setClosing(false);
  };
  // The first-run screens open once per session for a profile that has not
  // finished them; finishing marks the profile on the server. Until the app
  // knows which it is, the launch screen stays up, so a new account goes
  // straight to onboarding instead of seeing Home first. A profile known to
  // be onboarded on this phone opens Home at once, without waiting.
  const onboarded = useRef(false);
  const onboardKey = "omen.onboarded." + props.address;
  const [gate, setGate] = useState<"wait" | "open">(guest ? "open" : "wait");
  useEffect(() => {
    void SecureStore.getItemAsync(onboardKey)
      .then((v) => v === "true" && setGate("open"))
      .catch(() => undefined);
    // Never hold the app on the launch screen for long.
    const timer = setTimeout(() => setGate("open"), 6000);
    return () => clearTimeout(timer);
  }, [onboardKey]);
  useEffect(() => {
    if (me.isError) {
      setGate("open");
      return;
    }
    const profile = me.data?.data;
    if (!profile) return;
    if (profile.onboardedAt) {
      void SecureStore.setItemAsync(onboardKey, "true").catch(() => undefined);
    } else if (!onboarded.current) {
      onboarded.current = true;
      nav({ type: "onboarding" });
    }
    setGate("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data, me.isError]);
  const storage = "omen.hide." + props.address;
  useEffect(() => {
    void SecureStore.getItemAsync(storage).then((v) => setHidden(v === "true"));
  }, [storage]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (routes.length) {
        back();
        return true;
      }
      if (tab !== "Home" && !guest) {
        setTab("Home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [routes.length, locked, tab, closing]);
  useEffect(() => {
    if (props.sessionError) showErrorToast(props.sessionError);
  }, [props.sessionError]);
  const toggleHidden = () =>
    setHidden((v) => {
      void SecureStore.setItemAsync(storage, String(!v));
      return !v;
    });
  const action = async (resource: string, body: unknown, method = "POST") => {
    if (guest) {
      askSignIn();
      return null;
    }
    try {
      return await act(resource, body, method);
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Please try again.");
      return null;
    }
  };
  const star = async (mint: string) => {
    await action(
      "watchlist",
      { mint },
      watches.data?.data.includes(mint) ? "DELETE" : "POST",
    );
  };
  if (gate === "wait") return <LaunchScreen />;
  return (
    <Context.Provider
      value={{
        ...props,
        guest,
        askSignIn,
        tab,
        setTab,
        nav,
        back,
        hidden,
        toggleHidden,
        positions,
        scope,
        setScope,
        wallets,
        scopeLabel,
        openWallets: () => setWalletsOpen(true),
        importPending,
        setImportPending,
        pendingBuy,
        setPendingBuy,
        me,
        watches,
        star,
        action,
        setLocked,
        dialog,
        openLink: (url: string) => {
          const safe = safeUrl(url);
          if (safe) nav({ type: "browser", url: safe });
        },
      }}
    >
      <SafeAreaView edges={["top", "bottom"]} style={m.screen}>
        <View style={{ flex: 1 }}>
          <View
            style={[
              StyleSheet.absoluteFill,
              // Tabs show again the moment the last screen starts sliding out.
              { display: routes.length - (closing ? 1 : 0) ? "none" : "flex" },
            ]}
          >
            {OMEN_TABS.map((t) => (
              <TabFade key={t} selected={tab === t}>
                {t === "Home" ? (
                  <Home active={tab === t && !routes.length} />
                ) : t === "Search" ? (
                  <SearchScreen active={tab === t && !routes.length} />
                ) : t === "Dividends" ? (
                  <View style={{ flex: 1 }}>
                    {/* The screen draws the title itself, with the timeframe
                        chips on the same row. */}
                    <ActivityScreen
                      dividends
                      tab
                      active={tab === t && !routes.length}
                    />
                  </View>
                ) : t === "Agent" ? (
                  <AgentScreen
                    hidden={hidden}
                    cashUsd={(positions.data?.data.holdings ?? [])
                      .filter((h) => isCash(h.asset.mint))
                      .reduce((sum, h) => sum + Number(h.valueUsd ?? 0), 0)}
                  />
                ) : (
                  <ProfileScreen active={tab === t && !routes.length} />
                )}
              </TabFade>
            ))}
            <OmenNavigation selected={tab} onSelect={setTab} />
          </View>
          {routes.map((r, i) => {
            const top = i === routes.length - 1;
            // The screen underneath is shown while the top one slides away.
            const shown = top || (closing && i === routes.length - 2);
            return (
              <View
                key={i}
                pointerEvents="box-none"
                style={[
                  StyleSheet.absoluteFill,
                  { display: shown ? "flex" : "none" },
                ]}
              >
                <ScreenTransition
                  visible={!(top && closing)}
                  onHidden={top ? finishClose : undefined}
                >
                  <View style={{ flex: 1, backgroundColor: colors.canvas }}>
                    {r.type !== "asset" &&
                    r.type !== "dividends" &&
                    r.type !== "onboarding" ? (
                      <View style={s.detailHeader}>
                        <IconButton
                          name="back"
                          label="Go back"
                          quiet
                          size={22}
                          onPress={back}
                          disabled={locked}
                        />
                        <Text style={[m.heading, { flex: 1 }]}>
                          {r.type === "relations"
                            ? r.direction === "followers"
                              ? "Followers"
                              : "Following"
                            : (
                                {
                                  browser: "Browser",
                                  profile: "Trader",
                                  activity: "Activity",
                                  dividends:
                                    "symbol" in r && r.symbol
                                      ? r.symbol + " Dividends"
                                      : "Dividends",
                                  portfolio: "Your assets",
                                  drip: "DRIP",
                                  dripDetail:
                                    "row" in r && r.row.drip
                                      ? dripTitle(r.row)
                                      : "DRIP",
                                  watchlist: "Watchlist",
                                  receive: "Deposit",
                                  send: "Send",
                                  settings: "Settings",
                                  edit: "Edit profile",
                                  blocked: "Blocked profiles",
                                } as any
                              )[r.type]}
                        </Text>
                        {r.type === "drip" ? (
                          <IconButton
                            quiet
                            name="info"
                            label="What is DRIP"
                            onPress={() =>
                              dialog(
                                "DRIP",
                                "DRIP (Dividend Reinvestment Plan) automatically puts the rewards your assets earn back to work. Reinvest them into the same asset, invest them into another asset, cash them out or split them across a strategy you choose.",
                              )
                            }
                          />
                        ) : null}
                      </View>
                    ) : null}
                    <RouteView route={r} active={top && !closing} />
                  </View>
                </ScreenTransition>
              </View>
            );
          })}
        </View>
        <WalletDrawer
          visible={walletsOpen}
          onClose={() => setWalletsOpen(false)}
          wallets={wallets}
          totalUsd={scope === "all" ? (positions.data?.data.totalUsd ?? null) : null}
          scope={scope}
          onScope={setScope}
          hidden={hidden}
          onImport={() => {
            setImportPending(true);
            setTabState("Profile");
            nav({ type: "settings" });
          }}
        />
        <OmenDialog
          content={sheetContent}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
        />
      </SafeAreaView>
    </Context.Provider>
  );
}
function Home({ active }: { active: boolean }) {
  const a = useApp();
  const { fontScale } = useWindowDimensions();
  const hasWatch = Boolean(a.watches.data?.data.length);
  const watch = useMobile<Asset[]>(
    "assets",
    {
      scope: "all",
      filters: JSON.stringify({ watchlisted: true }),
      watchlist: (a.watches.data?.data || []).join(","),
    },
    active && hasWatch,
    10000,
  );
  // Trending and Best are not shown on Home any more; their lists are not
  // fetched either (the queries stay for the day they come back).
  const trending = useMobile<Asset[]>(
    "assets",
    {
      scope: "stonk",
      sort: "volume",
      filters: JSON.stringify({ kind: "reward" }),
    },
    false,
    0,
  );
  // Ranked by dividends the payout index measured over the last day.
  const best = useMobile<Asset[]>(
    "assets",
    {
      scope: "stonk",
      sort: "apr",
      filters: JSON.stringify({ kind: "reward" }),
    },
    false,
    0,
  );
  const p: Portfolio | undefined = a.positions.data?.data;
  const me = a.me.data?.data;
  const copyAddress = () =>
    void Clipboard.setStringAsync(a.address)
      .then(() => showToast("Address copied"))
      .catch(() => showErrorToast("Could not copy address."));
  // Live lists keep the order they first showed while values update; a pull
  // to refresh, or coming back to the tab, ranks them afresh.
  const [refreshCount, setRefreshCount] = useState(0);
  const orderToken = `${active}:${refreshCount}`;
  const trendingRows = useStableOrder(
    trending.data?.data,
    assetKey,
    orderToken,
  );
  const bestRows = useStableOrder(best.data?.data, assetKey, orderToken);
  const watchRows = useStableOrder(watch.data?.data, assetKey, orderToken);
  const openAssets = (watched = false) => {
    if (watched) a.nav({ type: "watchlist" });
    else a.setTab("Search");
  };
  const refresh = () => {
    setRefreshCount((n) => n + 1);
    return Promise.allSettled([
      a.positions.refetch(),
      a.me.refetch(),
      ...(hasWatch ? [watch.refetch()] : []),
    ]);
  };
  const pnl = p?.pnl24h == null ? null : Number(p.pnl24h);
  const changeColor = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? colors.muted
      : value > 0
        ? colors.success
        : value < 0
          ? colors.error
          : colors.mist;
  const signedNumber = (value: number) =>
    (value > 0 ? "+" : value < 0 ? "-" : "") +
    Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  const tileWidth = Math.min(224, 176 * Math.max(1, fontScale));
  const tiles = (assets: Asset[], figure: "cap" | "apr" = "cap") => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10 }}
    >
      {assets.map((asset) => (
        <Pressable
          key={asset.mint}
          accessibilityRole="button"
          accessibilityLabel={`${asset.symbol}, ${assetPrice(asset.price)}, 24 hour change ${pct(asset.change24h)}${figure === "apr" ? ", " + assetSortMetric(asset, "apr") : ""}`}
          onPress={() => a.nav({ type: "asset", mint: asset.mint })}
          style={({ pressed }) => [
            s.assetTile,
            {
              width: tileWidth,
              height: TILE_HEIGHT,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <View style={[m.row, { gap: 6, height: 20 }]}>
            <AssetIcon asset={asset} size={20} />
            <Text
              numberOfLines={1}
              style={[
                m.text,
                { flex: 1, fontSize: 12, fontFamily: fonts.bold },
              ]}
            >
              {asset.symbol}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                m.label,
                { fontSize: 11, fontFamily: fonts.numericMedium },
              ]}
            >
              {figure === "apr"
                ? assetSortMetric(asset, "apr")
                : usd(asset.marketCap, true) + " MC"}
            </Text>
          </View>
          <View style={[m.between, { gap: 6, height: 24 }]}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                m.metric,
                { fontSize: 18, lineHeight: 24, flexShrink: 1 },
              ]}
            >
              {assetPrice(asset.price)}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                m.label,
                {
                  fontSize: 11,
                  fontFamily: fonts.numericMedium,
                  fontVariant: ["tabular-nums"],
                  color: changeColor(asset.change24h),
                },
              ]}
            >
              {asset.change24h == null
                ? "0%"
                : `${signedNumber(asset.change24h)}%`}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
  return (
    <Page refresh={refresh}>
      <View style={s.balanceCard}>
        {/* Who this is: the picture and name over the balance, and the
            address copied from the button beside them. 32 px, loaded or not. */}
        <View style={[m.row, { gap: 10, height: 32, marginBottom: 6 }]}>
          {me ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch wallet"
              onPress={a.openWallets}
              style={({ pressed }) => [m.row, { gap: 10, flexShrink: 1, opacity: pressed ? 0.6 : 1 }]}
            >
              <Avatar profile={me} size={28} />
              <Text
                numberOfLines={1}
                style={[m.text, { fontFamily: fonts.medium, flexShrink: 1 }]}
              >
                {a.scopeLabel ?? me.displayName}
              </Text>
              <Icon name="chevron" size={14} color={colors.muted} />
            </Pressable>
          ) : (
            <>
              <Skeleton height={28} width={28} radius={14} />
              <Skeleton height={14} width={110} />
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy wallet address"
            onPress={copyAddress}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Icon name="copy" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <View style={[m.between, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={[m.row, { gap: 0 }]}>
              {!p && a.positions.isPending ? (
                /* 32 + 5 top and bottom is the balance's 42 px line, so the
                   figure lands where the placeholder sat; 150 wide stops it
                   reaching the deposit and withdraw buttons. */
                <Skeleton
                  height={32}
                  width={150}
                  radius={10}
                  style={{ marginVertical: 5 }}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[s.balance, { flexShrink: 1 }]}
                >
                  {a.hidden ? "••••" : usd(p?.totalUsd)}
                </Text>
              )}
              <IconButton
                name={a.hidden ? "eyeOff" : "eye"}
                label={a.hidden ? "Show balances" : "Hide balances"}
                onPress={a.toggleHidden}
              />
            </View>
            {/* Under the balance: the day's trading P&L ("-$0.12 24h"), then
                the day's dividends. Both pulse while the portfolio loads. */}
            {/* One line under the balance: unrealized P&L over the open
                positions behind its glyph, then the day's dividends behind
                theirs (which opens the Dividends tab). 26 px, loaded or not. */}
            <View style={[m.row, { gap: 20, height: 26 }]}>
              {a.positions.isPending && !p ? (
                [0, 1].map((i) => <Skeleton key={i} height={14} width={78} />)
              ) : (
                <>
                  <View
                    accessibilityLabel="Unrealized profit and loss"
                    style={[m.row, { gap: 6 }]}
                  >
                    <Icon name="trend" size={14} color={colors.muted} />
                    <Text
                      style={[
                        m.metric,
                        {
                          fontSize: 16,
                          lineHeight: 22,
                          color: pnlTone(p?.unrealizedUsd),
                        },
                      ]}
                    >
                      {a.hidden ? "••••" : signedUsd(p?.unrealizedUsd)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dividends received today"
                    onPress={() => a.nav({ type: "dividends" })}
                    hitSlop={6}
                    style={({ pressed }) => [
                      m.row,
                      { gap: 6, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Icon name="payout" size={14} color={colors.muted} />
                    <Text style={[m.metric, { fontSize: 16, lineHeight: 22 }]}>
                      {a.hidden
                        ? "••••"
                        : p?.dividends24h == null ||
                            Number(p.dividends24h) === 0
                          ? "$0"
                          : usd(p.dividends24h)}
                    </Text>
                    <Icon name="chevron" size={14} color={colors.muted} />
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View style={[m.row, { gap: 10, marginTop: 4 }]}>
            {(
              [
                ["depositTray", "Deposit assets", "receive"],
                ["withdrawTray", "Withdraw assets", "send"],
              ] as const
            ).map(([icon, label, route]) => (
              <Pressable
                key={route}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => a.nav({ type: route })}
                style={({ pressed }) => [
                  s.moveButton,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Icon name={icon} size={20} color={colors.ice} />
              </Pressable>
            ))}
          </View>
        </View>
        {a.positions.isError ? (
          <Pressable onPress={() => void a.positions.refetch()}>
            <Text style={m.label}>Balance unavailable. Retry</Text>
          </Pressable>
        ) : p?.unpriced ? (
          <Text style={m.label}>Partial balance · {p.unpriced} unpriced</Text>
        ) : a.positions.data?.coverage === "partial" ? (
          <Text style={m.label}>Estimated balance</Text>
        ) : null}
      </View>
      {/* Home is the user's own things: what they watch, then what they hold.
          The Best APY and Top Stonks rankings are hidden for now (2026-09-17);
          Search still ranks everything. */}
      <Section
        title="Watchlist"
        action={hasWatch || a.watches.isPending ? "View all" : undefined}
        onPress={() => openAssets(true)}
      >
        {/* Tiles and their skeleton are the same fixed height, and the
            empty note takes that height too, so the Positions heading below
            stays where it is from the first frame. */}
        <View style={{ height: TILE_HEIGHT, justifyContent: "center" }}>
          {hasWatch || a.watches.isPending ? (
            <LoadState
              query={watch}
              skeleton={<SkeletonTiles width={tileWidth} />}
            >
              {tiles(watchRows)}
            </LoadState>
          ) : (
            <Text style={m.muted}>
              Nothing watched yet. Tap the star on any token to follow it here.
            </Text>
          )}
        </View>
      </Section>
      <Section title="Portfolio">
        <PortfolioContent address={a.scope} active hidden={a.hidden} />
      </Section>
    </Page>
  );
}

type QuickSort = "volume" | "apr" | "cap";
const quickSorts: QuickSort[] = ["volume", "apr", "cap"];
function SearchScreen({ active }: { active: boolean }) {
  const a = useApp();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<QuickSort>("volume");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [sheet, setSheet] = useState(false);
  const [cursor, setCursor] = useState("0");
  const key = "omen.search." + a.address;
  // A tap before the saved state loads must win over the stale load.
  const touched = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(key)
      .then((value) => {
        if (cancelled || touched.current) return;
        try {
          const saved = JSON.parse(value || "{}");
          const next =
            saved.version === 2 ? saved.filters : saved.filters?.stonk;
          if (next && typeof next === "object" && !Array.isArray(next)) {
            const { watchlisted: _, ...rest } = next;
            setFilters(rest);
          }
          if (quickSorts.includes(saved.sort)) setSort(saved.sort);
          if (saved.direction === "asc") setDirection("asc");
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (q.trim() !== search) setRows([]);
      setSearch(q.trim());
      setCursor("0");
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  // What the tab lists and searches: every token (the Stonk index, and the
  // whole chain by name), tokenized stocks, or Hylo's leveraged tokens.
  // One at a time; a search reaches the chosen list only.
  type SearchType = "tokens" | "stocks" | "prestocks" | "leverage";
  const [type, setType] = useState<SearchType>("tokens");
  const types: { value: SearchType; label: string }[] = [
    { value: "tokens", label: "Tokens" },
    { value: "stocks", label: "Stocks" },
    { value: "prestocks", label: "PreStocks" },
    { value: "leverage", label: "Leverage" },
  ];
  const chooseType = (next: SearchType) => {
    if (next === type) return;
    setType(next);
    setRows([]);
    setCursor("0");
  };
  // APR is a Stonk figure: the other lists rank by volume in its place.
  const listSort = type !== "tokens" && sort === "apr" ? "volume" : sort;
  const assets = useMobile<Asset[]>(
    "assets",
    {
      scope: "stonk",
      type,
      q: search,
      sort: listSort,
      direction,
      filters: JSON.stringify(filters),
      cursor,
    },
    active,
    10000,
  );
  // Pages accumulate as the user scrolls; a new query starts over at "0".
  const [rows, setRows] = useState<Asset[]>([]);
  useEffect(() => {
    const page = assets.data?.data;
    if (!page) return;
    setRows((prev) => {
      if (cursor === "0") return page;
      const seen = new Set(prev.map((x) => x.mint));
      return [...prev, ...page.filter((x) => !seen.has(x.mint))];
    });
  }, [assets.data, cursor]);
  // The first page renders straight from the query so a fresh result never
  // passes through an empty frame before the accumulated rows catch up.
  const visible = rows.length ? rows : (assets.data?.data ?? []);
  const loadMore = () => {
    const next = assets.data?.nextCursor;
    if (next && next !== cursor && !assets.isFetching) setCursor(next);
  };
  const save = (
    nextFilters: Filters,
    nextSort = sort,
    nextDirection = direction,
  ) => {
    touched.current = true;
    setFilters(nextFilters);
    setSort(nextSort);
    setDirection(nextDirection);
    setCursor("0");
    void SecureStore.setItemAsync(
      key,
      JSON.stringify({
        version: 2,
        filters: nextFilters,
        sort: nextSort,
        direction: nextDirection,
      }),
    ).catch(() => showErrorToast("Could not save filters."));
  };
  const paste = async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) {
        showErrorToast("Nothing to paste yet.");
        return;
      }
      setQ(text.slice(0, 80));
    } catch {
      showErrorToast("Could not paste. Please try again.");
    }
  };
  const count = Object.values(filters).filter(
    (value) => value !== undefined && value !== false && value !== "",
  ).length;
  return (
    <>
      <View
        style={{ paddingHorizontal: space.edge, paddingTop: space.md, gap: 8 }}
      >
        {/* Plain words, the chosen one white and the rest grey, like the
            sort row under the field. */}
        <View style={[m.row, { gap: 22, minHeight: 36 }]}>
          {types.map((item) => {
            const on = item.value === type;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityLabel={"Show " + item.label.toLowerCase()}
                accessibilityState={{ selected: on }}
                onPress={() => chooseType(item.value)}
                hitSlop={8}
                style={({ pressed }) => ({ justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
              >
                <Text
                  style={[
                    m.text,
                    { fontFamily: fonts.medium, fontSize: 15, color: on ? colors.ice : colors.muted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          style={[
            m.row,
            m.input,
            {
              backgroundColor: "transparent",
              paddingVertical: 0,
              paddingRight: 12,
              gap: 0,
              // The pill's rounded ends make it read narrower than the flat
              // sort row below, so it overhangs the content column slightly.
              marginHorizontal: -space.sm,
            },
          ]}
        >
          <Field
            accessibilityLabel={"Search " + type}
            placeholder={"search " + (type === "prestocks" ? "pre-IPO" : type) + "..."}
            value={q}
            onChangeText={setQ}
            maxLength={80}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              minWidth: 0,
              paddingHorizontal: 0,
              borderWidth: 0,
              backgroundColor: "transparent",
            }}
          />
          {q ? (
            <IconButton
              name="close"
              label="Clear search"
              quiet
              size={14}
              onPress={() => setQ("")}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste into search"
            onPress={() => void paste()}
            style={({ pressed }) => ({
              minHeight: 44,
              minWidth: 48,
              justifyContent: "center",
              alignItems: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 13 }]}>
              Paste
            </Text>
          </Pressable>
        </View>
        <View style={[m.between, { gap: 4 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 22 }}
          >
            {(
              [
                { label: "Volume", value: "volume" },
                { label: "APR", value: "apr" },
                { label: "Market cap", value: "cap" },
              ] as const
            )
              .filter((item) => item.value !== "apr" || type === "tokens")
              .map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityLabel={
                  listSort === item.value
                    ? "Sort by " +
                      item.label +
                      ", " +
                      (direction === "desc"
                        ? "highest first"
                        : "lowest first") +
                      ", tap to flip"
                    : "Sort by " + item.label
                }
                accessibilityState={{ selected: listSort === item.value }}
                // Tapping the active sort flips its direction.
                onPress={() =>
                  listSort === item.value
                    ? save(filters, sort, direction === "desc" ? "asc" : "desc")
                    : save(filters, item.value, "desc")
                }
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={[
                    m.text,
                    {
                      fontSize: 13,
                      fontFamily: fonts.medium,
                      color: listSort === item.value ? colors.ice : colors.muted,
                    },
                  ]}
                >
                  {item.label}
                  {listSort === item.value
                    ? direction === "desc"
                      ? " ↓"
                      : " ↑"
                    : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={count ? `Filters, ${count} active` : "Filters"}
            onPress={() => setSheet(true)}
            style={[
              m.row,
              {
                minHeight: 44,
                minWidth: 44,
                justifyContent: "flex-end",
                gap: 4,
              },
            ]}
          >
            <Icon
              name="filter"
              size={18}
              color={count ? colors.ice : colors.muted}
            />
            {count ? <Text style={m.muted}>{count}</Text> : null}
          </Pressable>
        </View>
      </View>
      <Page compact refresh={() => assets.refetch()} onEndReached={loadMore}>
        {visible.length ? (
          <View>
            {visible.map((asset) => (
              <AssetRow
                key={asset.mint}
                asset={asset}
                plain
                metric={assetSortMetric(asset, sort)}
                onPress={() => a.nav({ type: "asset", mint: asset.mint })}
              />
            ))}
          </View>
        ) : assets.isPending || (assets.isFetching && !assets.data) ? (
          // A screenful of placeholders, so the list never appears to grow
          // out of a short stub.
          <SkeletonRows plain count={12} />
        ) : assets.isError ? (
          <Empty
            title="Couldn't load right now."
            action="Try again"
            onPress={() => void assets.refetch()}
          />
        ) : (
          <Empty
            title="No matching stonks"
            detail="Try another search or reset your filters."
            action="Reset filters"
            onPress={() => {
              save({});
              setQ("");
            }}
          />
        )}
        {visible.length && assets.isFetching && cursor !== "0" ? (
          <Text style={[m.muted, { textAlign: "center" }]}>Loading more…</Text>
        ) : null}
      </Page>
      <OmenSheet
        visible={sheet}
        title="Filters"
        tall
        onClose={() => setSheet(false)}
      >
        <FilterEditor
          key={String(sheet)}
          initial={filters}
          stonk
          onClose={() => setSheet(false)}
          onApply={(next) => {
            save(next);
            setSheet(false);
          }}
        />
      </OmenSheet>
    </>
  );
}
function WatchlistScreen({ active }: { active: boolean }) {
  const a = useApp();
  const [cursor, setCursor] = useState("0");
  const mints = (a.watches.data?.data || []).join(",");
  const assets = useMobile<Asset[]>(
    "assets",
    {
      scope: "all",
      filters: JSON.stringify({ watchlisted: true }),
      watchlist: mints,
      // The first page is Home's watchlist query, same key: no second fetch.
      ...(cursor !== "0" ? { cursor } : {}),
    },
    active && Boolean(mints),
    10000,
  );
  return (
    <Page compact refresh={() => assets.refetch()}>
      <LoadState query={a.watches}>
        {!mints ? (
          <Empty
            title="Your watchlist is empty"
            detail="Tap the star on an asset to save it."
          />
        ) : (
          <LoadState query={assets}>
            <View>
              {assets.data?.data.map((asset) => (
                <AssetRow
                  key={asset.mint}
                  asset={asset}
                  plain
                  onPress={() => a.nav({ type: "asset", mint: asset.mint })}
                />
              ))}
            </View>
            <Pagination
              cursor={cursor}
              next={assets.data?.nextCursor}
              setCursor={setCursor}
            />
          </LoadState>
        )}
      </LoadState>
    </Page>
  );
}
function Pagination({
  cursor,
  next,
  setCursor,
}: {
  cursor: string;
  next?: string | null;
  setCursor: (c: string) => void;
}) {
  return (
    <View style={m.between}>
      {cursor !== "0" ? (
        <Chip label="First page" onPress={() => setCursor("0")} />
      ) : (
        <View />
      )}
      {next ? (
        <Chip label="Next page →" onPress={() => setCursor(next)} />
      ) : null}
    </View>
  );
}
function FilterEditor({
  initial,
  stonk,
  onClose,
  onApply,
}: {
  initial: Filters;
  stonk: boolean;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial)
        .filter(([, v]) => typeof v !== "boolean")
        .map(([k, v]) => [k, String(v)]),
    ),
  );
  const rows = [
    ["Market cap ($)", "capMin", "capMax"],
    ["Liquidity ($)", "liquidityMin", "liquidityMax"],
    ["24h volume ($)", "volumeMin", "volumeMax"],
    ["24h change (%)", "changeMin", "changeMax"],
    ["Age (days)", "ageMin", "ageMax"],
  ];
  const apply = () => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (!v.trim()) continue;
      if (["kind", "payout", "stage"].includes(k)) out[k] = v.trim();
      else {
        const n = Number(v);
        if (!Number.isFinite(n)) {
          showErrorToast("Enter valid filter amounts.");
          return;
        }
        out[k] = n;
      }
    }
    for (const [, min, max] of rows)
      if (
        out[min] !== undefined &&
        out[max] !== undefined &&
        Number(out[min]) > Number(out[max])
      ) {
        showErrorToast("Minimum must not exceed maximum.");
        return;
      }
    onApply(out as Filters);
  };
  const field = (
    k: string,
    label: string,
    placeholder: string,
    numeric = true,
  ) => (
    <Field
      key={k}
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={numeric ? "numbers-and-punctuation" : "default"}
      autoCapitalize="none"
      autoCorrect={false}
      value={draft[k] || ""}
      onChangeText={(v) => setDraft((d) => ({ ...d, [k]: v }))}
      style={[
        s.filterField,
        numeric && {
          fontFamily: fonts.numericMedium,
          fontVariant: ["tabular-nums"],
        },
      ]}
    />
  );
  const chips = (label: string, key: string, options: [string, string][]) => (
    <View style={{ gap: 8 }}>
      <Text style={m.label}>{label}</Text>
      <View style={[m.row, { gap: 8, flexWrap: "wrap" }]}>
        {options.map(([v, text]) => (
          <Chip
            key={v}
            label={text}
            selected={(draft[key] || "") === v}
            onPress={() => setDraft((d) => ({ ...d, [key]: v }))}
          />
        ))}
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <Page compact>
        {rows.map(([label, min, max]) => (
          <View key={label} style={{ gap: 8 }}>
            <Text style={m.label}>{label}</Text>
            <View style={[m.row, { gap: 8 }]}>
              {field(min, label + " minimum", "Min")}
              <Text style={[m.muted, { fontSize: 12 }]}>to</Text>
              {field(max, label + " maximum", "Max")}
            </View>
          </View>
        ))}
        {stonk ? (
          <>
            {chips("Token type", "kind", [
              ["", "Any"],
              ["reward", "Pays dividends"],
              ["standard", "Standard"],
            ])}
            <View style={{ gap: 8 }}>
              <Text style={m.label}>Payout token</Text>
              {field("payout", "Payout token", "Symbol or mint", false)}
            </View>
            {chips("Transfer tax", "taxBps", [
              ["", "Any"],
              ["0", "0%"],
              ["100", "1%"],
              ["300", "3%"],
            ])}
            {chips("Launch stage", "stage", [
              ["", "Any"],
              ["bonding", "Bonding"],
              ["graduated", "Graduated"],
            ])}
          </>
        ) : null}
      </Page>
      <View
        style={[
          m.row,
          { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 12 },
        ]}
      >
        <Button
          title="Reset"
          secondary
          onPress={() => setDraft({})}
          style={{ minWidth: 104 }}
        />
        <Button title="Apply filters" onPress={apply} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
function InAppPage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  return (
    <View style={{ flex: 1 }}>
      <Text
        numberOfLines={1}
        style={[m.muted, { paddingHorizontal: 24, paddingBottom: 12 }]}
      >
        {new URL(url).hostname}
      </Text>
      {loading ? (
        <View style={{ height: 3, backgroundColor: colors.cobalt }} />
      ) : null}
      {failed ? (
        <Empty
          title="Page unavailable"
          action="Retry"
          onPress={() => {
            setFailed(false);
            setLoading(true);
            setAttempt((x) => x + 1);
          }}
        />
      ) : (
        <WebView
          key={attempt}
          source={{ uri: url }}
          style={{ backgroundColor: colors.canvas }}
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          onShouldStartLoadWithRequest={(request) =>
            Boolean(safeUrl(request.url)) || request.url === "about:blank"
          }
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onLoadEnd={() => setLoading(false)}
        />
      )}
    </View>
  );
}

function RouteView({ route, active }: { route: Route; active: boolean }) {
  switch (route.type) {
    case "browser":
      return <InAppPage url={route.url} />;
    case "asset":
      return <AssetScreen mint={route.mint} active={active} />;
    case "profile":
      return <ProfileScreen id={route.id} active={active} />;
    case "activity":
    case "dividends":
      return (
        <ActivityScreen
          dividends={route.type === "dividends"}
          address={route.address}
          mint={route.mint}
          symbol={route.symbol}
          role={route.role}
          active={active}
        />
      );
    case "portfolio":
      return <PortfolioScreen address={route.address} active={active} />;
    case "onboarding":
      return <OnboardingScreen />;
    case "dripDetail":
      return <DripDetail row={route.row} />;
    case "drip":
      return (
        <DripScreen
          kind={route.kind}
          mint={route.mint}
          symbol={route.symbol}
          payout={route.payout}
          payoutSymbol={route.payoutSymbol}
          active={active}
        />
      );
    case "watchlist":
      return <WatchlistScreen active={active} />;
    case "receive":
      return <Receive />;
    case "send":
      return <Send mint={"mint" in route ? route.mint : undefined} />;
    case "settings":
      return <Settings />;
    case "edit":
      return <EditProfile />;
    case "blocked":
      return <PeopleList active={active} blocked />;
    case "relations":
      return (
        <PeopleList active={active} id={route.id} direction={route.direction} />
      );
  }
}
// The page's header (back, token, share, watchlist) is drawn above the
// scroll view for real, so the skeleton starts at the price row and mirrors
// the page from there: price and stat on one 40 px line, their captions on
// the next, the chart frame, the period chips, two panels.
function AssetPageSkeleton() {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={{ gap: space.lg }}
    >
      <View style={[m.between, { alignItems: "flex-start", gap: 12 }]}>
        <View style={{ gap: 4 }}>
          <View style={s.figureLine}>
            <Skeleton height={32} width={200} radius={10} />
          </View>
          <View style={{ height: 18, justifyContent: "center" }}>
            <Skeleton height={12} width={110} />
          </View>
        </View>
        <View style={{ width: 116, alignItems: "flex-end", gap: 4 }}>
          <View style={s.figureLine}>
            <Skeleton height={18} width={80} />
          </View>
          <View style={{ height: 18, justifyContent: "center" }}>
            <Skeleton height={10} width={64} />
          </View>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ height: 264, justifyContent: "center" }}>
          <Skeleton height={220} width="100%" radius={12} />
        </View>
        <View style={[m.row, { gap: 18, minHeight: 40 }]}>
          {[22, 26, 22, 26, 24].map((w, i) => (
            <Skeleton key={i} height={13} width={w} />
          ))}
        </View>
      </View>
      <Skeleton height={104} width="100%" radius={radius.panel} />
      <Skeleton height={104} width="100%" radius={radius.panel} />
    </View>
  );
}
function ProfileSkeleton() {
  return (
    // Mirrors the profile row for row: avatar with name and handle and the
    // two round targets, the link line, the timeframe chips, the two stats,
    // the section tabs, then rows. Same heights, so nothing jumps on load.
    <View
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={{ gap: space.lg }}
    >
      <View style={[m.row, { gap: 14 }]}>
        <Skeleton height={56} circle />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={20} width={150} />
          <Skeleton height={13} width={96} />
        </View>
        <Skeleton height={22} circle />
        <Skeleton height={22} circle style={{ marginLeft: 22 }} />
      </View>
      <View style={{ minHeight: 40, justifyContent: "center" }}>
        <Skeleton height={13} width={80} />
      </View>
      <View style={[m.row, { gap: 18, minHeight: 36 }]}>
        {[28, 20, 28, 20].map((w, i) => (
          <Skeleton key={i} height={13} width={w} />
        ))}
      </View>
      <View style={[m.row, { gap: 24, alignItems: "flex-start" }]}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1, gap: 2 }}>
            <View style={{ height: 16, justifyContent: "center" }}>
              <Skeleton height={12} width={80} />
            </View>
            <View style={{ height: 28, justifyContent: "center" }}>
              <Skeleton height={22} width={90} />
            </View>
          </View>
        ))}
      </View>
      <View style={[m.row, { gap: 22, minHeight: 40 }]}>
        {[72, 60, 76].map((w, i) => (
          <Skeleton key={i} height={16} width={w} />
        ))}
      </View>
      <SkeletonRows />
    </View>
  );
}
const chartPeriods: { value: Period; label: string }[] = [
  { value: "1H", label: "1h" },
  { value: "4H", label: "4h" },
  { value: "24H", label: "1d" },
  { value: "7D", label: "7d" },
  { value: "All", label: "All" },
];
const headlineStats = ["cap", "volume", "apr"] as const;
/**
 * One headline figure beside the price, market cap first so the price has
 * its context; a tap cycles to volume, then APR. Figure first, name under it.
 */
function CompactStat({
  asset,
  index,
  onNext,
}: {
  asset: Asset;
  index: number;
  onNext: () => void;
}) {
  const items = {
    // A figure the feed does not carry (USDC has no market cap from the
    // price feed) reads as unknown, not as zero.
    cap: {
      label: "Market cap",
      value: asset.marketCap == null ? "–" : usd(asset.marketCap, true),
    },
    volume: {
      label: "Volume 24h",
      value: asset.volume24h == null ? "–" : usd(asset.volume24h, true),
    },
    apr: {
      label: "APR",
      value: assetSortMetric(asset, "apr").replace(" APR", ""),
    },
  } as const;
  const n = headlineStats.length;
  const current = items[headlineStats[index % n]];
  const next = items[headlineStats[(index + 1) % n]];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        current.label + " " + current.value + ", tap for " + next.label
      }
      onPress={onNext}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 116,
        flexShrink: 0,
        alignItems: "flex-end",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={s.figureLine}>
        <Text
          numberOfLines={1}
          style={[
            m.text,
            {
              fontFamily: fonts.numericBold,
              fontSize: 18,
              lineHeight: 22,
              includeFontPadding: false,
              fontVariant: ["tabular-nums"],
            },
          ]}
        >
          {current.value}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="swap" size={11} color={colors.muted} />
        <Text
          numberOfLines={1}
          style={[m.label, { fontSize: 11, lineHeight: 18 }]}
        >
          {current.label}
        </Text>
      </View>
    </Pressable>
  );
}
/** A buy-side and sell-side figure shown green / red on one row. */
type Pair = { buy: string | null; sell: string | null };
/** Label and value rows under a heading, for the token's About section. */
function DetailGroup({
  title,
  rows,
  pending = false,
}: {
  title: string;
  rows: (readonly [string, string | Pair | null | undefined] | null)[];
  /** True while the figures load: every row is laid out with a placeholder. */
  pending?: boolean;
}) {
  if (pending) {
    const labels = rows
      .filter((r): r is readonly [string, string | Pair | null | undefined] =>
        Boolean(r),
      )
      .map((r) => r[0]);
    if (!labels.length) return null;
    return (
      <View
        style={{ gap: 2 }}
        accessibilityLabel="Loading"
        accessibilityState={{ busy: true }}
      >
        <Text style={[m.heading, { fontSize: 16, marginBottom: 4 }]}>
          {title}
        </Text>
        {labels.map((label) => (
          <View key={label} style={[m.between, { minHeight: 32 }]}>
            <Text style={m.muted}>{label}</Text>
            <Skeleton height={14} width={64} />
          </View>
        ))}
      </View>
    );
  }
  const shown = rows.filter((r): r is readonly [string, string | Pair] =>
    Boolean(r && r[1] && (typeof r[1] === "string" || r[1].buy || r[1].sell)),
  );
  if (!shown.length) return null;
  const figure: TextStyle[] = [
    m.text,
    { fontFamily: fonts.numericMedium, fontVariant: ["tabular-nums"] },
  ];
  return (
    <View style={{ gap: 2 }}>
      <Text style={[m.heading, { fontSize: 16, marginBottom: 4 }]}>
        {title}
      </Text>
      {shown.map(([label, value]) => (
        <View key={label} style={[m.between, { minHeight: 32 }]}>
          <Text style={m.muted}>{label}</Text>
          {typeof value === "string" ? (
            <Text numberOfLines={1} style={figure}>
              {value}
            </Text>
          ) : (
            <Text numberOfLines={1} style={figure}>
              <Text style={{ color: colors.success }}>{value.buy ?? "–"}</Text>
              <Text style={{ color: colors.muted }}> / </Text>
              <Text style={{ color: colors.error }}>{value.sell ?? "–"}</Text>
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
const count = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? null
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? null : usd(n, true);
function AssetScreen({ mint, active }: { mint: string; active: boolean }) {
  const a = useApp(),
    [period, setPeriod] = useState<Period>(() => chartPrefs().period),
    [candle, setCandle] = useState(() => chartPrefs().candlestick),
    [stat, setStat] = useState(0),
    [selected, setSelected] = useState<Candle | null>(null),
    // While a finger scrubs the chart the whole page is frozen, so a slightly
    // vertical drag reads the chart instead of scrolling the screen.
    [scrubbing, setScrubbing] = useState(false),
    // The width the headline price may take, measured once laid out, so a
    // long sub-cent figure is sized to fit it on one line.
    [priceWidth, setPriceWidth] = useState(0);
  // The list that was tapped already holds this token, so the page opens
  // with its price and name on screen and the request only refreshes them.
  const client = useQueryClient();
  const { user } = usePrivy();
  const seed = useMemo(() => {
    // The portfolio the app holds is the first place to look: a holding's
    // asset carries name, symbol, image, price and stonk fields.
    const held = (a.positions.data?.data as Portfolio | undefined)?.holdings.find((h) => h.asset.mint === mint)?.asset;
    if (held)
      return {
        data: { ...emptyAsset(mint), ...held } as Asset,
        observedAt: a.positions.data!.observedAt,
        coverage: a.positions.data!.coverage,
      } as Envelope<Asset>;
    for (const [, cached] of client.getQueriesData<Envelope<unknown>>({
      queryKey: ["mobile", user?.id],
    })) {
      const rows = cached?.data;
      if (!Array.isArray(rows)) continue;
      // List rows only: an activity row also carries a mint and symbol
      // but is not an asset.
      const hit =
        rows.find((r: any) => r?.mint === mint && r?.symbol && !r.kind && !r.signature) ??
        rows.find((r: any) => r?.asset?.mint === mint)?.asset;
      // Whatever the cached row lacks (a holding's asset carries fewer
      // fields than a list row) reads as unknown rather than crashing.
      if (hit)
        return {
          data: { ...emptyAsset(mint), ...(hit as Partial<Asset>) } as Asset,
          observedAt: cached!.observedAt,
          coverage: cached!.coverage,
        } as Envelope<Asset>;
    }
    return undefined;
    // Read once when the page opens; the query owns it from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);
  const data = useMobile<Asset>("asset", { mint }, active, 10000, {
    placeholder: seed,
  });
  // Activity and holder figures sit at the bottom of the page and come from
  // slower calls, so they load on their own and never hold up the header.
  const statsQuery = useMobile<AssetStats | null>(
    "stats",
    { mint },
    active,
    60000,
  );
  // What this token has paid the wallet, by the token that paid it.
  const sources = useMobile<DividendSources>(
    "dividend-sources",
    { address: a.scope, tz: TZ },
    // Only a held token or one that pays dividends can have paid this wallet.
    active &&
      Boolean(
        (a.positions.data?.data as Portfolio | undefined)?.holdings.some((h) => h.asset.mint === mint) ||
          data.data?.data.stonk?.kind === "reward",
      ),
    60000,
  );
  const paidByThis = sources.data?.data.sources.find((s) => s.mint === mint);
  // Switching timeframe keeps the last chart on screen until the new one
  // arrives, and the other timeframes are fetched ahead so a switch is instant.
  const chart = useMobile<Candle[]>(
    "candles",
    { mint, period },
    active,
    10000,
    {
      keepPrevious: true,
    },
  );
  const prefetch = usePrefetchMobile();
  useEffect(() => {
    if (!active) return;
    for (const item of chartPeriods)
      if (item.value !== period)
        prefetch("candles", { mint, period: item.value });
    // Once per token page: the current period is fetched by the query itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint, active]);
  // The price refreshes every 10 s; older than 45 s, or after a failed
  // refresh, it is shown as delayed rather than live.
  const asset = data.data?.data;
  const stats = statsQuery.data?.data ?? asset?.stats ?? null;
  const holding: Holding | undefined = a.positions.data?.data.holdings.find(
    (h: Holding) => h.asset.mint === mint && BigInt(h.raw) > 0n,
  );
  const rows = chart.data?.data || [];
  // The star answers the tap at once: filled or cleared immediately, a short
  // toast, and the server state takes over once it agrees.
  const [watchOverride, setWatchOverride] = useState<boolean | null>(null);
  const serverWatched = Boolean(a.watches.data?.data.includes(mint));
  const watched = watchOverride ?? serverWatched;
  useEffect(() => {
    if (watchOverride !== null && serverWatched === watchOverride)
      setWatchOverride(null);
  }, [watchOverride, serverWatched]);
  const toggleWatch = async () => {
    const next = !watched;
    setWatchOverride(next);
    const name = asset?.symbol || "Token";
    showToast(
      next
        ? name + " added to your watchlist"
        : name + " removed from your watchlist",
    );
    try {
      await a.star(mint);
    } catch {
      setWatchOverride(null);
      showErrorToast("Couldn't update your watchlist. Try again.");
    }
  };
  // The headline change follows the chart window: first price of the window
  // to the live price, as an arrow, a dollar move and a percentage.
  const windowLabel = chartPeriods.find((x) => x.value === period)?.label || "";
  const move = periodChange(rows, asset?.price ?? null);
  // Sub-cent moves ("$0.00000012") would run the line past its width; the
  // percentage alone says it.
  const absPart = (abs: number) =>
    Math.abs(abs) >= 0.01 ? assetPrice(Math.abs(abs)) + " " : "";
  const moveLine = move
    ? `${move.abs > 0 ? "▲ " : move.abs < 0 ? "▼ " : ""}${absPart(move.abs)}${absPart(move.abs) ? "(" + pct(move.pct) + ")" : pct(move.pct)} ${windowLabel}`
    : asset?.change24h != null
      ? `${asset.change24h > 0 ? "▲ " : asset.change24h < 0 ? "▼ " : ""}${pct(asset.change24h)} 24h`
      : "";
  const moveValue = move ? move.pct : asset?.change24h;
  // While scrubbing the chart, the headline is that moment's price and how
  // far it sits from the live price.
  const scrub =
    selected && asset?.price
      ? {
          abs: selected.close - asset.price,
          pct: ((selected.close - asset.price) / asset.price) * 100,
        }
      : null;
  const scrubLine =
    selected && scrub
      ? `${scrub.abs > 0 ? "▲ " : scrub.abs < 0 ? "▼ " : ""}${absPart(scrub.abs)}${absPart(scrub.abs) ? "(" + pct(scrub.pct) + ")" : pct(scrub.pct)}`
      : "";
  const tone = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? colors.muted
      : value >= 0
        ? colors.success
        : colors.error;
  // Shares the token's page on the OMEN website.
  const share = () => {
    const url = config.siteUrl + "/dashboard/tokens/" + mint;
    void Share.share(
      {
        title: "Checkout " + (asset?.symbol || "this stonk") + " on Omen",
        message:
          "Checkout " + (asset?.symbol || "this stonk") + " on Omen " + url,
        url,
      },
      { dialogTitle: "Share on Omen" },
    ).catch(() => {});
  };
  const unrealized =
    holding?.unrealizedUsd == null ? null : Number(holding.unrealizedUsd);
  // Quick trade dock: one dollar amount. Buys spend the USDC cash balance,
  // sells always sell this token, and the slider picks the side. Execution
  // is not wired yet.
  const [typed, setTyped] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  // The dock is in one mode at a time, chosen with the Buy / Sell buttons, so
  // a percentage or a typed amount always says which balance it applies to.
  const [side, setSide] = useState<"buy" | "sell">("buy");
  // Closed, the dock is just the two buttons; a tap raises the panel.
  const [dockOpen, setDockOpen] = useState(false);
  const [dockRise] = useState(() => new Animated.Value(0));
  // Space the page keeps free under the dock, animated with the dock so the
  // content slides up as the card comes down instead of jumping afterwards.
  const [dockInset] = useState(() => new Animated.Value(90));
  // After a fill the card shrinks to one line ("Bought 7,687 ZINU") and closes
  // itself; an error stays in the card under the slider instead of a popup.
  // The fill card: the line ("Bought 7,687 ZINU") shows the moment the swipe
  // completes with dots while the send is in flight; `tail` ("for $1.00")
  // fades in when it is done, then the card closes itself.
  const [result, setResult] = useState<{
    line: string;
    tail: string;
    done: boolean;
  } | null>(null);
  const [tailFade] = useState(() => new Animated.Value(0));
  // Bumped on a failed attempt: the slider shakes and buzzes instead of text
  // appearing (the reason goes to a toast, which shifts nothing).
  const [errorSignal, setErrorSignal] = useState(0);
  const reduceMotion = useReducedMotion();
  // Keyboard height, animated: the open dock rides above the keyboard so the
  // slider stays reachable while the amount is being typed.
  const [keyboardRise] = useState(() => new Animated.Value(0));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const move = (height: number) => {
      setKeyboardHeight(height);
      Animated.timing(keyboardRise, {
        toValue: height,
        duration: reduceMotion ? 0 : 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    const shown = Keyboard.addListener("keyboardDidShow", (e) =>
      move(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => move(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [keyboardRise, reduceMotion]);
  const switchSide = (which: "buy" | "sell") => {
    setSide(which);
    setPercent(null);
  };
  const openDock = (which: "buy" | "sell") => {
    if (a.guest) return a.askSignIn();
    switchSide(which);
    setResult(null);
    setDockOpen(true);
    dockRise.setValue(reduceMotion ? 1 : 0);
    const duration = reduceMotion ? 0 : 160;
    Animated.parallel([
      Animated.timing(dockRise, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dockInset, {
        toValue: 300,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };
  // Arriving with a buy pending (the empty dividends page's "Buy X").
  useEffect(() => {
    if (active && a.pendingBuy === mint) {
      a.setPendingBuy(null);
      openDock("buy");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.pendingBuy, active, mint]);
  const closeDock = () => {
    // Everything moves at once: keyboard away, card down, page space closing.
    // Ease-out, so the card leaves immediately rather than after a pause.
    Keyboard.dismiss();
    // A fill card leaving after its message should drift away, not snap:
    // longer than the open, eased at both ends, the buttons fading in
    // under it at the same pace.
    const duration = reduceMotion ? 0 : result ? 320 : 180;
    const easing = result
      ? Easing.inOut(Easing.cubic)
      : Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(keyboardRise, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(dockRise, {
        toValue: 0,
        duration,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(dockInset, {
        toValue: 90,
        duration,
        easing,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setDockOpen(false);
      setResult(null);
    });
  };
  const cashUsd = Number(
    a.positions.data?.data.holdings.find((h: Holding) => h.asset.mint === USDC)
      ?.quantity || 0,
  );
  const price = asset?.price ?? null;
  const positionUsd =
    holding?.valueUsd != null
      ? Number(holding.valueUsd)
      : price != null
        ? Number(holding?.quantity || 0) * price
        : 0;
  const selling = side === "sell";
  const basis = selling ? positionUsd : cashUsd;
  const amountUsd =
    percent != null
      ? percent === 100
        ? basis
        : (basis * percent) / 100
      : Number(typed) || 0;
  const amountText =
    percent != null
      ? amountUsd
        ? String(Number(amountUsd.toPrecision(6)))
        : ""
      : typed;
  const tokenQty = price ? amountUsd / price : null;
  const qty = formatTokenQty;
  const symbol = asset?.symbol || "";
  // Cash is the balance you trade with, not something to trade: its page
  // offers the deposit and withdraw screens instead of a buy and a sell.
  const isCash = mint === USDC;
  const actions = useChainActions();
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  // Base units for the quote: buys spend USDC (6 decimals), sells spend the
  // held token, capped at what is actually held.
  const buyUnits = amountUsd > 0 ? String(Math.round(amountUsd * 1e6)) : "";
  const sellUnits = (() => {
    if (!holding) return "";
    const raw = BigInt(holding.raw || "0");
    if (raw <= 0n) return "";
    if (percent != null)
      return (
        percent === 100 ? raw : (raw * BigInt(percent)) / 100n
      ).toString();
    if (!price || amountUsd <= 0) return "";
    const units = BigInt(
      Math.round((amountUsd / price) * 10 ** holding.decimals),
    );
    return (units > raw ? raw : units).toString();
  })();
  const previewSide: "buy" | "sell" = selling ? "sell" : "buy";
  const previewUnits = previewSide === "buy" ? buyUnits : sellUnits;
  const hasAmount = Boolean(previewUnits) && previewUnits !== "0";
  // More than the cash (buying) or the position (selling) is worth: the
  // slider says so and stays locked instead of failing after the drag.
  const overBalance = amountUsd > basis + 1e-6;
  // A trade is at least a dollar (the server holds the same line). The one
  // exception is selling a whole position that is worth less: otherwise a
  // holding under a dollar could never be closed.
  const sellingAll =
    selling && Boolean(holding) && sellUnits === String(holding?.raw ?? "");
  const belowMin = hasAmount && amountUsd < MIN_TRADE_USD - 1e-9 && !sellingAll;
  // A sale comes from the wallet holding the token (the one holding the
  // most of it); more than that wallet holds is sold in as many pieces.
  const sellWallet = walletHolding(holding);
  const sellLegs = selling && sellUnits ? splitAcrossWallets(holding, BigInt(sellUnits)) : [];
  const buyWallet = a.scope === "all" ? undefined : (a.scope as string);
  const quoted = useMobile<Quote>(
    "quote",
    {
      side: previewSide,
      mint,
      amount: previewUnits,
      ...(previewSide === "sell" && sellWallet ? { wallet: sellWallet } : previewSide === "buy" && buyWallet ? { wallet: buyWallet } : {}),
    },
    active && Boolean(previewUnits) && previewUnits !== "0" && !belowMin && sellLegs.length < 2,
    8000,
  );
  const live = quoted.data?.data ? { ...quoted.data.data, wallet: previewSide === "sell" ? sellWallet : buyWallet } : undefined;
  const liveMatches =
    live && live.side === previewSide && live.inAmount === previewUnits;
  const quotedTokens =
    liveMatches && live.side === "buy"
      ? Number(live.outAmount) / 10 ** live.tokenDecimals
      : null;
  const quotedUsd =
    liveMatches && live.side === "sell" ? Number(live.outAmount) / 1e6 : null;
  const submitTrade = async (which: "buy" | "sell") => {
    if (busy) return;
    const units = which === "buy" ? buyUnits : sellUnits;
    if (!units || units === "0") {
      showErrorToast(
        which === "buy" ? "Enter an amount to buy." : "Nothing to sell.",
      );
      return;
    }
    if (belowMin) {
      showErrorToast("The minimum trade is " + usd(MIN_TRADE_USD) + ".");
      return;
    }
    // A first buy of a token also pays its account's rent, on top.
    const extraUsd = which === "buy" && liveMatches ? (live?.charges?.rentUsd ?? 0) : 0;
    if (amountUsd + extraUsd > (which === "buy" ? cashUsd : positionUsd) + 1e-6) {
      showErrorToast(
        which === "buy"
          ? extraUsd
            ? "Not enough USDC: this first buy also pays " + usd(extraUsd) + " for the token account."
            : "Not enough USDC. Deposit first."
          : "That is more " + symbol + " than you hold.",
      );
      return;
    }
    setBusy(which);
    // The card changes the moment the swipe completes: what is being bought
    // or sold, with dots while the send is out. The form comes back only if
    // the trade fails.
    const tokens =
      which === "buy"
        ? (quotedTokens ?? tokenQty)
        : Number(sellUnits) / 10 ** (holding?.decimals ?? 0);
    const line =
      (which === "buy" ? "Bought " : "Sold ") +
      (tokens != null ? qty(tokens) + " " : "") +
      symbol;
    // The dollar figure is known before the send (what was typed, or the
    // live quote for a sale), so the card is laid out with it from the
    // start and nothing moves when the fill confirms it.
    const expected =
      "for " +
      usd(which === "sell" && quotedUsd != null ? quotedUsd : amountUsd);
    const showFill = () => {
      Keyboard.dismiss();
      if (!reduceMotion)
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            180,
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.opacity,
          ),
        );
      tailFade.setValue(0);
      setResult({ line, tail: expected, done: false });
      Animated.timing(dockInset, {
        toValue: 130,
        duration: reduceMotion ? 0 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    showFill();
    try {
      // The dock keeps a live quote for exactly this size; a swipe reuses it
      // while it is fresh instead of paying for another round trip.
      const legs =
        which === "sell"
          ? splitAcrossWallets(holding, BigInt(units))
          : [{ wallet: a.scope === "all" ? undefined : (a.scope as string), amount: BigInt(units) }];
      const fresh = legs.length === 1 && liveMatches && Date.now() - quoted.dataUpdatedAt < 8000;
      let q: Quote | undefined;
      let inTotal = 0, outTotal = 0;
      for (const leg of legs) {
        const lq =
          fresh && live && legs.length === 1
            ? live
            : await actions.quote({ side: which, mint, amount: leg.amount.toString(), wallet: leg.wallet });
        await actions.swap(lq, asset);
        q = q ? { ...lq, inAmount: String(Number(q.inAmount) + Number(lq.inAmount)), outAmount: String(Number(q.outAmount) + Number(lq.outAmount)) } : lq;
        inTotal += Number(lq.inAmount);
        outTotal += Number(lq.outAmount);
      }
      if (!q) throw new Error("Nothing to sell.");
      const tail = "for " + usd(which === "buy" ? inTotal / 1e6 : outTotal / 1e6);
      setTyped("");
      setPercent(null);
      // The line keeps its wording unless it had no quantity to show; a
      // rewrite would nudge everything sideways.
      setResult({
        line:
          tokens != null
            ? line
            : (which === "buy" ? "Bought " : "Sold ") +
              qty(
                Number(which === "buy" ? q.outAmount : q.inAmount) /
                  10 ** q.tokenDecimals,
              ) +
              " " +
              symbol,
        tail,
        done: true,
      });
      Animated.timing(tailFade, {
        toValue: 1,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: true,
      }).start();
      setTimeout(closeDock, 1400);
    } catch (e) {
      // Back to the form, with the slider's shake and the reason in a toast.
      if (!reduceMotion)
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            160,
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.opacity,
          ),
        );
      setResult(null);
      Animated.timing(dockInset, {
        toValue: 300,
        duration: reduceMotion ? 0 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      setTimeout(() => setErrorSignal((n) => n + 1), 60);
      showErrorToast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  // The tap path: a review that states side, size, cost and fee, with a
  // button that says what it does. The drag is its own deliberate confirmation.
  const reviewTrade = (which: "buy" | "sell") => {
    if (busy) return;
    const units = which === "buy" ? buyUnits : sellUnits;
    if (!units || units === "0") {
      showErrorToast(
        which === "buy" ? "Enter an amount to buy." : "Nothing to sell.",
      );
      return;
    }
    if (belowMin) {
      showErrorToast("The minimum trade is " + usd(MIN_TRADE_USD) + ".");
      return;
    }
    // A first buy of a token also pays its account's rent, on top.
    const extraUsd = which === "buy" && liveMatches ? (live?.charges?.rentUsd ?? 0) : 0;
    if (amountUsd + extraUsd > (which === "buy" ? cashUsd : positionUsd) + 1e-6) {
      showErrorToast(
        which === "buy"
          ? extraUsd
            ? "Not enough USDC: this first buy also pays " + usd(extraUsd) + " for the token account."
            : "Not enough USDC. Deposit first."
          : "That is more " + symbol + " than you hold.",
      );
      return;
    }
    const tokens = which === "buy" ? (quotedTokens ?? tokenQty) : tokenQty;
    const size = tokens != null ? qty(tokens) + " " + symbol : symbol;
    const verb = which === "buy" ? "Buy" : "Sell";
    const lines = [
      which === "buy"
        ? `Spend ${usd(amountUsd)} USDC for about ${size}.`
        : `Sell ${size} for about ${usd(quotedUsd ?? amountUsd)} USDC.`,
      liveMatches && live.feeBps ? "Includes OMEN's 0.5% fee." : "",
      liveMatches && live.charges ? "Plus " + usd(live.charges.rentUsd) + " for the new token account (rent, kept in your wallet as SOL)." : "",
      "Market order: the final amount can differ slightly from this estimate.",
    ].filter(Boolean);
    a.dialog(`${verb} ${symbol}?`, lines.join(" "), [
      { text: "Cancel", style: "cancel" },
      { text: `${verb} ${size}`, onPress: () => void submitTrade(which) },
    ]);
  };
  return (
    <View style={{ flex: 1 }}>
      {/* The header sits above the scroll view: back, token, share and
        watchlist stay in place while the page scrolls under them. */}
      <View style={s.assetHeader}>
        <View style={{ marginLeft: -12, marginRight: -2 }}>
          <IconButton name="back" label="Go back" quiet onPress={a.back} />
        </View>
        {asset ? (
          <>
            <AssetIcon asset={asset} size={28} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={[m.text, { fontFamily: fonts.bold, fontSize: 16 }]}
              >
                {asset.symbol}
              </Text>
              <Text
                numberOfLines={1}
                style={[m.muted, { fontSize: 11, lineHeight: 14 }]}
              >
                {asset.name}
              </Text>
            </View>
            {/* The two round targets overlap their padding so the glyphs
              sit close, as one pair of actions. */}
            <View
              style={{ flexDirection: "row", marginLeft: -6, marginRight: -6 }}
            >
              <IconButton
                name="share"
                label="Share asset"
                quiet
                onPress={share}
              />
              <View style={{ marginLeft: -14 }}>
                <IconButton
                  name="star"
                  label={watched ? "Remove from watchlist" : "Add to watchlist"}
                  quiet
                  selected={watched}
                  onPress={() => void toggleWatch()}
                />
              </View>
            </View>
          </>
        ) : (
          <Text style={m.heading}>Asset</Text>
        )}
      </View>
      <Page
        compact
        bottomInset={0}
        scrollEnabled={!scrubbing}
        refresh={() => Promise.allSettled([data.refetch(), chart.refetch()])}
      >
        <LoadState query={data} skeleton={<AssetPageSkeleton />}>
          {asset ? (
            <>
              {/* Two rows on both sides, same heights, so the figure sits level
                with the price and the names sit level with the change line. */}
              <View style={[m.between, { alignItems: "flex-start", gap: 12 }]}>
                <View
                  style={{ flex: 1, minWidth: 0 }}
                  onLayout={(e) => setPriceWidth(e.nativeEvent.layout.width)}
                >
                  {/* Sub-cent prices run to "$0.00000001234": the size is
                    fitted to the measured width (the bold figures average
                    0.6 em a glyph) so the price never wraps or clips. */}
                  {(() => {
                    const text = assetPrice(selected?.close ?? asset.price);
                    const fit = priceWidth
                      ? Math.floor(priceWidth / (text.length * 0.6))
                      : 34;
                    const fontSize = Math.max(18, Math.min(34, fit));
                    return (
                      <View style={s.figureLine}>
                        <Text
                          selectable
                          numberOfLines={1}
                          style={[
                            s.balance,
                            {
                              fontSize,
                              lineHeight: fontSize + 4,
                              includeFontPadding: false,
                              letterSpacing: fontSize < 34 ? -0.5 : -1,
                            },
                          ]}
                        >
                          {text}
                        </Text>
                      </View>
                    );
                  })()}
                  <Text
                    numberOfLines={1}
                    style={[
                      m.muted,
                      {
                        fontFamily: fonts.numeric,
                        fontVariant: ["tabular-nums"],
                        lineHeight: 18,
                        color: tone(selected ? scrub?.pct : moveValue),
                      },
                    ]}
                  >
                    {selected ? scrubLine : moveLine}
                  </Text>
                </View>
                <CompactStat
                  asset={asset}
                  index={stat}
                  onNext={() => setStat((i) => i + 1)}
                />
              </View>
              <View style={{ gap: 8 }}>
                {/* Every state is exactly the chart's height, so nothing shifts. */}
                {chart.isPending ? (
                  <Skeleton height={220} width="100%" radius={12} />
                ) : chart.isError && !chart.data ? (
                  <Pressable
                    onPress={() => void chart.refetch()}
                    accessibilityRole="button"
                    style={{
                      height: 220,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Icon name="chart" color={colors.muted} />
                    <Text style={m.muted}>Chart unavailable. Tap to retry</Text>
                  </Pressable>
                ) : (
                  <View style={{ opacity: chart.isPlaceholderData ? 0.45 : 1 }}>
                    <PriceChart
                      candles={rows}
                      candlestick={candle}
                      onSelect={setSelected}
                      onScrubStart={() => setScrubbing(true)}
                      onScrubEnd={() => setScrubbing(false)}
                    />
                  </View>
                )}
                {chart.isError && chart.data ? (
                  <Text style={m.muted}>Showing last chart update</Text>
                ) : null}
                <View style={[m.row, { gap: 18, justifyContent: "center" }]}>
                  {chartPeriods.map((item) => (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityLabel={"Chart period " + item.label}
                      accessibilityState={{ selected: item.value === period }}
                      onPress={() => {
                        setPeriod(item.value);
                        saveChartPrefs({ period: item.value });
                        setSelected(null);
                      }}
                      hitSlop={6}
                      style={({ pressed }) => ({
                        minHeight: 44,
                        minWidth: 32,
                        justifyContent: "center",
                        opacity: pressed ? 0.5 : 1,
                      })}
                    >
                      <Text
                        style={[
                          m.text,
                          {
                            fontSize: 13,
                            fontFamily: fonts.medium,
                            color:
                              item.value === period ? colors.ice : colors.muted,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                  <IconButton
                    name="chart"
                    quiet
                    label={
                      candle
                        ? "Switch to line chart"
                        : "Switch to candlestick chart"
                    }
                    selected={candle}
                    onPress={() => {
                      const next = !candle;
                      setCandle(next);
                      saveChartPrefs({ candlestick: next });
                    }}
                  />
                </View>
              </View>
              {/* A visitor holds nothing yet: the card would only ever say $0. */}
              <View
                style={[
                  m.panel,
                  m.between,
                  {
                    alignItems: "flex-end",
                    display: a.guest ? "none" : "flex",
                  },
                ]}
              >
                <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
                  <Text style={m.label}>Your position</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[m.metric, { fontSize: 24 }]}
                  >
                    {a.hidden ? "••••" : usd(holding?.valueUsd)}
                  </Text>
                </View>
                {/* The quantity and P&L, right-aligned beside the value. */}
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={[
                      m.muted,
                      { fontFamily: fonts.numeric, fontSize: 13 },
                    ]}
                  >
                    {a.hidden
                      ? "••••"
                      : (holding
                          ? Number(holding.quantity).toLocaleString("en-US", {
                              maximumSignificantDigits: 6,
                            })
                          : "0") +
                        " " +
                        asset.symbol}
                  </Text>
                  <Text
                    style={[
                      m.muted,
                      {
                        fontFamily: fonts.numeric,
                        fontSize: 13,
                        color: pnlTone(unrealized),
                      },
                    ]}
                  >
                    {a.hidden
                      ? "••••"
                      : "P&L " +
                        (unrealized == null ||
                        !Number.isFinite(unrealized) ||
                        unrealized === 0
                          ? "$0"
                          : (unrealized > 0 ? "+" : "-") +
                            usd(Math.abs(unrealized)))}
                  </Text>
                </View>
              </View>
              {asset.stonk?.kind === "reward" || (paidByThis && Number(paidByThis.usd) > 0) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={asset.symbol + " dividends history"}
                  onPress={() =>
                    a.nav({
                      type: "dividends",
                      mint,
                      symbol: asset.symbol,
                      role: "source",
                    })
                  }
                  style={[m.panel, m.between]}
                >
                  <View style={{ gap: 4, flex: 1 }}>
                    {/* What it pays and the holder tax; the day's receipts
                        under it only once there are any. */}
                    <View
                      accessibilityLabel={
                        "Pays " + (asset.stonk?.payoutSymbol || asset.symbol)
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icon name="payout" size={16} color={colors.mist} />
                      <Text style={[m.text, { color: colors.ice, fontFamily: fonts.medium }]}>
                        {asset.stonk?.payoutSymbol || asset.symbol}
                      </Text>
                      {/* Where the dividends come from: the holder tax on
                          transfers, the pool's own trading fees on a Raydium
                          launch with no transfer fee, or, on a tokenized
                          stock, the issuer reinvesting them. */}
                      <Text style={[m.text, { color: colors.mist }]}>
                        {!asset.stonk
                          ? "reinvested"
                          : asset.stonk.taxBps !== null
                            ? asset.stonk.taxBps / 100 + "% tax"
                            : "pool fees"}
                      </Text>
                    </View>
                    {a.guest ? (
                      <Text style={[m.muted, { fontSize: 13, lineHeight: 18 }]}>
                        Paid to holders automatically
                      </Text>
                    ) : sources.isPending && holding ? (
                      <Skeleton height={12} width={120} />
                    ) : Number(paidByThis?.usd24h ?? 0) > 0 ? (
                      <Text
                        style={[
                          m.muted,
                          { fontSize: 13, lineHeight: 18, fontFamily: fonts.numeric },
                        ]}
                      >
                        Received {a.hidden ? "••••" : usd(paidByThis?.usd24h)} today
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
              ) : asset.payers?.length ? (
                // A payout token: the tokens that pay dividends in it, as a
                // stack of their icons; the screen behind lists them.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    asset.payers.length +
                    " tokens pay dividends in " +
                    asset.symbol
                  }
                  onPress={() =>
                    a.nav({
                      type: "dividends",
                      mint,
                      symbol: asset.symbol,
                      role: "payout",
                    })
                  }
                  style={({ pressed }) => [
                    m.panel,
                    m.between,
                    { height: PAYERS_CARD_HEIGHT, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={{ gap: 6, flex: 1 }}>
                    <View style={[m.row, { gap: 6, height: 22 }]}>
                      <Icon name="payout" size={16} color={colors.ice} />
                      <Text style={[m.heading, { lineHeight: 22 }]}>
                        {asset.symbol}
                      </Text>
                    </View>
                    <IconStack
                      assets={asset.payers.map((p) => ({
                        ...emptyAsset(p.mint),
                        symbol: p.symbol,
                        name: p.symbol,
                        image: p.image,
                      }))}
                      caption={
                        asset.payers.length +
                        (asset.payers.length === 1
                          ? " token pays "
                          : " tokens pay ") +
                        asset.symbol
                      }
                    />
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
              ) : data.isPlaceholderData && !asset.stonk ? (
                // Opened from a list that does not carry this: the card keeps
                // its place until the page's own data says whether it applies.
                <View
                  style={[
                    m.panel,
                    {
                      height: PAYERS_CARD_HEIGHT,
                      gap: 6,
                      justifyContent: "center",
                    },
                  ]}
                >
                  <View style={[m.row, { gap: 6, height: 22 }]}>
                    <Skeleton height={16} circle />
                    <Skeleton height={16} width={90} />
                  </View>
                  <View style={[m.row, { gap: 8, height: 28 }]}>
                    <Skeleton height={28} width={120} radius={14} />
                    <Skeleton height={12} width={110} />
                  </View>
                </View>
              ) : null}
              <Section title="About">
                {asset.description ? (
                  <Description text={asset.description} />
                ) : null}
                <DetailGroup
                  pending={statsQuery.isPending}
                  title="Transactions 24h"
                  rows={[
                    ["Trades", count(stats?.trades24h)],
                    [
                      "Buys / sells",
                      {
                        buy: count(stats?.buys24h),
                        sell: count(stats?.sells24h),
                      },
                    ],
                    [
                      "Buy / sell volume",
                      {
                        buy: money(stats?.buyVolume24h),
                        sell: money(stats?.sellVolume24h),
                      },
                    ],
                    stats?.buyers24h != null || stats?.sellers24h != null
                      ? [
                          "Buyers / sellers",
                          {
                            buy: count(stats?.buyers24h),
                            sell: count(stats?.sellers24h),
                          },
                        ]
                      : ["Traders", count(stats?.traders24h)],
                  ]}
                />
                <DetailGroup
                  pending={statsQuery.isPending}
                  title="Holders"
                  rows={[
                    ["Holders", count(stats?.holders)],
                    [
                      "Top 10 hold",
                      stats?.top10Percent == null
                        ? null
                        : stats.top10Percent.toFixed(1) + "%",
                    ],
                  ]}
                />
                <DetailGroup
                  title="Stats"
                  rows={[
                    ["Market cap", money(asset.marketCap)],
                    ["Volume 24h", money(asset.volume24h)],
                    ["Liquidity", money(asset.liquidity)],
                    [
                      "Supply",
                      count(asset.circulatingSupply ?? stats?.totalSupply),
                    ],
                    [
                      "Created",
                      asset.createdAt
                        ? new Date(asset.createdAt).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )
                        : null,
                    ],
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copy contract address"
                  onPress={() =>
                    void Clipboard.setStringAsync(mint).then(() =>
                      showToast("Contract address copied."),
                    )
                  }
                  style={[m.between, { minHeight: 44 }]}
                >
                  <Text style={m.muted}>Contract</Text>
                  <Text
                    selectable
                    style={[m.text, { fontFamily: fonts.numericMedium }]}
                  >
                    {mint.slice(0, 6)}…{mint.slice(-6)} ⧉
                  </Text>
                </Pressable>
                <View style={[m.row, { flexWrap: "wrap", gap: 6 }]}>
                  {asset.website ? (
                    <Chip
                      label="Website"
                      onPress={() => a.openLink(asset.website!)}
                    />
                  ) : null}
                  {asset.socials.map((link) => (
                    <Chip
                      key={link.url}
                      label={link.label}
                      onPress={() => a.openLink(link.url)}
                    />
                  ))}
                </View>
              </Section>
            </>
          ) : null}
        </LoadState>
        {asset ? <Animated.View style={{ height: dockInset }} /> : null}
      </Page>
      {asset ? (
        <>
          {/* Content scrolling under the dock fades out instead of peeking past it. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: Animated.add(dockInset, 50 + keyboardHeight),
            }}
          >
            <LinearGradient
              colors={[colors.canvas + "00", colors.canvas + "F2"]}
              locations={[0, 0.6]}
              style={{ flex: 1 }}
            />
          </Animated.View>
          {/* The window is edge-to-edge, so the keyboard does not resize it and
          KeyboardAvoidingView cannot lift an absolutely placed dock. The dock
          rides up by the keyboard's own height instead, keeping the slider in
          reach right after typing an amount. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              s.tradeDockWrap,
              {
                transform: [
                  { translateY: Animated.multiply(keyboardRise, -1) },
                ],
              },
            ]}
          >
            {/* The Buy / Sell pair is always laid out; the card rises over it
            and it fades with the card's own progress, so closing reveals
            it instead of popping it in. */}
            <Animated.View
              pointerEvents={dockOpen ? "none" : "auto"}
              style={[
                s.tradeBar,
                dockOpen ? StyleSheet.absoluteFill : null,
                {
                  opacity: dockRise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
            >
              {isCash ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Deposit cash"
                    onPress={() => a.nav({ type: "receive" })}
                    style={({ pressed }) => [
                      s.tradeButton,
                      {
                        backgroundColor: colors.ice,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        m.text,
                        { fontFamily: fonts.bold, color: colors.canvas },
                      ]}
                    >
                      Deposit
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Withdraw cash"
                    onPress={() => a.nav({ type: "send", mint: USDC })}
                    style={({ pressed }) => [
                      s.tradeButton,
                      s.tradeButtonQuiet,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        m.text,
                        { fontFamily: fonts.bold, color: colors.ice },
                      ]}
                    >
                      Withdraw
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Buy " + symbol}
                    onPress={() => openDock("buy")}
                    style={({ pressed }) => [
                      s.tradeButton,
                      {
                        backgroundColor: colors.success,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        m.text,
                        { fontFamily: fonts.bold, color: colors.canvas },
                      ]}
                    >
                      Buy
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Sell " + symbol}
                    onPress={() => openDock("sell")}
                    style={({ pressed }) => [
                      s.tradeButton,
                      {
                        backgroundColor: colors.error,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        m.text,
                        { fontFamily: fonts.bold, color: colors.canvas },
                      ]}
                    >
                      Sell
                    </Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
            {dockOpen ? (
              <Animated.View
                style={[
                  s.tradeDock,
                  {
                    opacity: dockRise,
                    transform: [
                      {
                        translateY: dockRise.interpolate({
                          inputRange: [0, 1],
                          outputRange: [140, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {result ? (
                  <View style={s.dockResult} accessibilityLiveRegion="polite">
                    {/* Tick, line and dollar tail all occupy their final places from
                the first frame; only opacity changes as the fill lands. */}
                    <Animated.View style={{ width: 18, opacity: tailFade }}>
                      <Icon
                        name="check"
                        size={18}
                        color={selling ? colors.error : colors.success}
                      />
                    </Animated.View>
                    <Text
                      style={[
                        m.text,
                        { fontFamily: fonts.medium, flexShrink: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {result.line}
                    </Text>
                    <View style={{ justifyContent: "center" }}>
                      <Animated.Text
                        style={[
                          m.text,
                          {
                            fontFamily: fonts.medium,
                            color: colors.mist,
                            fontVariant: ["tabular-nums"],
                            opacity: tailFade,
                          },
                        ]}
                        accessibilityElementsHidden={!result.done}
                      >
                        {result.tail}
                      </Animated.Text>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: tailFade.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0],
                            }),
                          },
                        ]}
                      >
                        {result.done ? null : (
                          <Dots
                            color={selling ? colors.error : colors.success}
                          />
                        )}
                      </Animated.View>
                    </View>
                  </View>
                ) : (
                  <>
                    {/* The header names what the card is doing now, in the side's colour;
              the switch glyph on the left flips it, Close sits on the right. */}
                    <View style={m.between}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          selling ? "Switch to buy" : "Switch to sell"
                        }
                        onPress={() => switchSide(selling ? "buy" : "sell")}
                        hitSlop={8}
                        style={({ pressed }) => [
                          s.dockSwitch,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <Icon name="swap" size={18} color={colors.mist} />
                      </Pressable>
                      <Text
                        accessibilityRole="header"
                        style={[
                          m.text,
                          {
                            fontFamily: fonts.bold,
                            fontSize: 15,
                            color: selling ? colors.error : colors.success,
                          },
                        ]}
                      >
                        {selling ? "Sell " + symbol : "Buy " + symbol}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={closeDock}
                        hitSlop={8}
                        style={{
                          minHeight: 44,
                          minWidth: 44,
                          justifyContent: "center",
                          alignItems: "flex-end",
                        }}
                      >
                        <Text
                          style={[
                            m.text,
                            { fontFamily: fonts.medium, color: colors.muted },
                          ]}
                        >
                          Close
                        </Text>
                      </Pressable>
                    </View>
                    <View style={s.amountRow}>
                      <Text style={s.amountSign}>$</Text>
                      <Field
                        accessibilityLabel="Amount in dollars"
                        placeholder="0"
                        keyboardType="decimal-pad"
                        value={amountText}
                        onChangeText={(v) => {
                          setTyped(v);
                          setPercent(null);
                        }}
                        style={[
                          s.amountInput,
                          // A browser input keeps a fixed width whatever it
                          // holds (a native one hugs its text), which pushed
                          // "$0" off centre: size it to its digits.
                          Platform.OS === "web"
                            ? ({
                                width: Math.max(1, amountText.length) + "ch",
                              } as object)
                            : null,
                        ]}
                      />
                    </View>
                    {/* Dollars only: what can be spent, or what the held tokens are worth. */}
                    <Text
                      numberOfLines={1}
                      style={[
                        m.muted,
                        {
                          textAlign: "center",
                          fontFamily: fonts.numeric,
                          fontSize: 12,
                          fontVariant: ["tabular-nums"],
                        },
                      ]}
                    >
                      {usd(selling ? positionUsd : cashUsd) + " available"}
                    </Text>
                    <View style={[m.row, { gap: 8, justifyContent: "center" }]}>
                      {[10, 25, 50, 100].map((p) => (
                        <Pressable
                          key={p}
                          accessibilityRole="button"
                          accessibilityState={{ selected: percent === p }}
                          accessibilityLabel={
                            (p === 100 ? "Maximum" : p + " percent") +
                            (selling ? " of your " + symbol : " of your cash")
                          }
                          onPress={() => {
                            // A second tap on the chosen amount clears it.
                            setPercent(percent === p ? null : p);
                            setTyped("");
                          }}
                          hitSlop={4}
                          style={({ pressed }) => [
                            s.percentChip,
                            percent === p && s.percentChipOn,
                            { opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Text
                            style={[
                              m.text,
                              {
                                fontSize: 13,
                                color: percent === p ? colors.ice : colors.mist,
                                fontFamily:
                                  p === 100
                                    ? fonts.medium
                                    : fonts.numericMedium,
                              },
                            ]}
                          >
                            {p === 100 ? "Max" : p + "%"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <SlideToConfirm
                      label={
                        busy
                          ? (busy === "buy" ? "Buying " : "Selling ") +
                            symbol +
                            "…"
                          : overBalance
                            ? "Insufficient balance"
                            : belowMin
                              ? "Minimum " + usd(MIN_TRADE_USD)
                              : hasAmount
                                ? selling
                                  ? "Slide to sell"
                                  : "Slide to buy"
                                : "Enter an amount"
                      }
                      color={selling ? colors.error : colors.success}
                      disabled={
                        Boolean(busy) || !hasAmount || overBalance || belowMin
                      }
                      errorSignal={errorSignal}
                      onConfirm={() => {
                        playSound("trade");
                        void submitTrade(side);
                      }}
                      onTap={() => reviewTrade(side)}
                    />
                  </>
                )}
              </Animated.View>
            ) : null}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const profileSections = ["Portfolio", "Activity"] as const;
type DividendSources = {
  totalUsd: string;
  sources: {
    mint: string;
    symbol: string | null;
    usd: string;
    /** The last day's share of `usd`. */
    usd24h?: string;
    /** The sum over each chart window (1h, 4h, 1d, 7d, 30d, All). */
    byPeriod?: Record<string, string>;
    count: number;
    last: string;
  }[];
};
/**
 * A long description shows its first lines under a fade with "Read more";
 * a short one is shown whole.
 */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 260;
  return (
    <View>
      <View style={{ overflow: "hidden" }}>
        <Text style={m.muted} numberOfLines={long && !open ? 4 : undefined}>
          {text}
        </Text>
        {long && !open ? (
          <LinearGradient
            pointerEvents="none"
            colors={[colors.canvas + "00", colors.canvas]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 44,
            }}
          />
        ) : null}
      </View>
      {long ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          style={({ pressed }) => ({
            paddingTop: 6,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={m.link}>{open ? "Show less" : "Read more"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const ONBOARDING_PAGES: {
  icon: IconName;
  title: string;
  body: string;
  note?: string;
}[] = [
  {
    icon: "swap",
    title: "Trade anything",
    body: "Trade crypto, tokenized stocks and more.",
  },
  {
    icon: "payout",
    title: "Get dividends",
    body: "DRIP reinvests your dividends from stocks and memecoins into asset of your choosing.",
  },
  {
    icon: "agent",
    title: "Discover narratives",
    body: "Personalized finance agent in your pocket. Research markets, manage portfolios, form convictions.",
    note: "Coming soon",
  },
  {
    icon: "ticket",
    title: "Have a referral?",
    body: "Enjoy 0% trading fees for first month.",
  },
];
/** Referral codes are digits: "2026" and a country's calling code. */
const REFERRAL_CODE_MAX = 10;
/** The referral keypad, laid out like a calculator; "" is the empty key. */
const KEYPAD: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"],
];
/**
 * The first-run screens: four pages a swipe apart, the last with the
 * referral code typed on the app's own keypad (so nothing moves for the
 * system keyboard). Everyone goes through them: there is no skip, and the
 * profile is marked onboarded only at the end, so leaving part-way starts
 * over next time. A code is redeemed on the way out.
 */
function OnboardingScreen() {
  const a = useApp();
  // The page width is the list's own measured width: the window figure can
  // include system insets on Android and would leave the pages misaligned.
  const [width, setWidth] = useState(useWindowDimensions().width);
  // The list has to fill the space between the logo and the dots, or a page
  // has no room to centre its content in and everything sits at the top.
  const [height, setHeight] = useState(0);
  const list = useRef<FlatList<(typeof ONBOARDING_PAGES)[number]>>(null);
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const last = page === ONBOARDING_PAGES.length - 1;
  const go = (i: number) => {
    list.current?.scrollToIndex({ index: i, animated: true });
    setPage(i);
  };
  const press = (key: string) => {
    if (busy || !key) return;
    setCode((c) =>
      key === "delete"
        ? c.slice(0, -1)
        : c.length < REFERRAL_CODE_MAX
          ? c + key
          : c,
    );
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (code) {
        const r = await a.action("referral", { code });
        if (!r) return; // the toast said why; the code stays for another try
        showToast(
          "0% trading fees until " +
            new Date((r as any).data.feeFreeUntil).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
              },
            ),
        );
      }
      await a.action("onboarding", {});
      void a.me.refetch();
      a.back();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={[
          m.row,
          {
            paddingHorizontal: space.edge,
            paddingTop: space.sm,
            minHeight: 48,
          },
        ]}
      >
        <Mark small />
      </View>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        onLayout={(e) => {
          setWidth(Math.round(e.nativeEvent.layout.width));
          setHeight(Math.round(e.nativeEvent.layout.height));
        }}
        data={ONBOARDING_PAGES}
        keyExtractor={(p) => p.title}
        horizontal
        pagingEnabled
        scrollEnabled={!busy}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        renderItem={({ item, index }) => {
          const referral = index === ONBOARDING_PAGES.length - 1;
          return (
            <View
              style={{
                width,
                height: height || undefined,
                flex: 1,
                paddingHorizontal: space.edge,
                paddingTop: referral ? 20 : 0,
                paddingBottom: referral ? 0 : 48,
                alignItems: "center",
                justifyContent: referral ? "flex-start" : "center",
              }}
            >
              {/* The column is centred on the page, which on a wide browser
              window keeps it off the left edge; what is inside it stays
              left-aligned. */}
              <View
                style={{
                  width: "100%",
                  maxWidth: 420,
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <View style={[s.onboardGlyph, { alignItems: "flex-start" }]}>
                  <Icon name={item.icon} size={56} color={colors.ice} />
                </View>
                {/* Two lines are reserved, so a longer title wraps instead of
              being cut and the pages do not shift as they are swiped. The
              web has no adjustsFontSizeToFit, which is what truncated the
              longest title to "Discover narrativ…". */}
                <View
                  style={{
                    alignSelf: "stretch",
                    height: 76,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      m.title,
                      {
                        fontSize: 30,
                        lineHeight: 38,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                </View>
                <Text
                  style={[
                    m.text,
                    {
                      fontSize: 17,
                      lineHeight: 26,
                      color: colors.mist,
                    },
                  ]}
                >
                  {item.body.split(/(\d+%)/).map((part, i) =>
                    /^\d+%$/.test(part) ? (
                      <Text key={i} style={{ fontFamily: fonts.numericMedium }}>
                        {part}
                      </Text>
                    ) : (
                      part
                    ),
                  )}
                </Text>
                {item.note ? (
                  <Text
                    style={[
                      m.label,
                      { fontSize: 12, letterSpacing: 0.8, color: colors.muted },
                    ]}
                  >
                    {item.note.toUpperCase()}
                  </Text>
                ) : null}
                {index === ONBOARDING_PAGES.length - 1 ? (
                  <>
                    <View
                      accessibilityLabel="Referral code"
                      style={s.onboardCode}
                    >
                      <Text
                        style={[
                          m.text,
                          {
                            fontFamily: fonts.numericMedium,
                            fontSize: code ? 24 : 17,
                            letterSpacing: code ? 3 : 0,
                            color: code ? colors.ice : colors.muted,
                          },
                        ]}
                      >
                        {code || "Enter code (optional)"}
                      </Text>
                    </View>
                    <View style={{ alignSelf: "stretch", gap: 6 }}>
                      {KEYPAD.map((row, r) => (
                        <View key={r} style={{ flexDirection: "row", gap: 6 }}>
                          {row.map((key, k) => (
                            <Pressable
                              key={k}
                              accessibilityRole="button"
                              accessibilityLabel={
                                key === "delete" ? "Delete" : key || "Empty"
                              }
                              disabled={!key || busy}
                              onPress={() => press(key)}
                              style={({ pressed }) => [
                                s.onboardKey,
                                !key && { opacity: 0 },
                                pressed && { backgroundColor: colors.cardLine },
                              ]}
                            >
                              {key === "delete" ? (
                                <Icon
                                  name="back"
                                  size={22}
                                  color={colors.ice}
                                />
                              ) : (
                                <Text
                                  style={[
                                    m.text,
                                    {
                                      fontFamily: fonts.numericMedium,
                                      fontSize: 22,
                                    },
                                  ]}
                                >
                                  {key}
                                </Text>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          );
        }}
      />
      <View
        style={{
          paddingHorizontal: space.edge,
          paddingBottom: space.xl,
          gap: 20,
        }}
      >
        <View style={[m.row, { gap: 6, justifyContent: "center" }]}>
          {ONBOARDING_PAGES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? colors.ice : colors.line,
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => (last ? void finish() : go(page + 1))}
          style={({ pressed }) => [
            s.onboardButton,
            { opacity: pressed || busy ? 0.7 : 1 },
          ]}
        >
          {busy ? (
            <Dots color={colors.canvas} />
          ) : (
            <Text
              style={[
                m.text,
                { fontFamily: fonts.bold, fontSize: 16, color: colors.canvas },
              ]}
            >
              {last ? (code ? "Redeem and start" : "Start") : "Next"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
/** Up to five token icons overlapping, then "+N", with a caption beside. */
function IconStack({
  assets,
  caption,
  size = 24,
}: {
  assets: Asset[];
  caption: string;
  size?: number;
}) {
  const shown = assets.slice(0, 5);
  const more = assets.length - shown.length;
  return (
    <View style={[m.row, { gap: 8, height: size + 4 }]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {shown.map((x, i) => (
          <View
            key={x.mint}
            style={{
              marginLeft: i ? -size * 0.35 : 0,
              borderRadius: size / 2 + 2,
              borderWidth: 2,
              borderColor: colors.card,
              zIndex: shown.length - i,
            }}
          >
            <AssetIcon asset={x} size={size} />
          </View>
        ))}
        {more > 0 ? (
          <View
            style={[
              m.avatar,
              {
                width: size + 4,
                height: size + 4,
                borderRadius: size / 2 + 2,
                marginLeft: -size * 0.35,
                borderWidth: 2,
                borderColor: colors.card,
              },
            ]}
          >
            <Text style={[m.text, { fontSize: 10, fontFamily: fonts.medium }]}>
              +{more}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[m.muted, { fontSize: 12, flexShrink: 1 }]}
      >
        {caption}
      </Text>
    </View>
  );
}
/** The X picture when X supplies one, otherwise the initial on the avatar tone. */
function Avatar({
  profile,
  size,
}: {
  profile: Pick<Profile, "avatarUrl" | "avatar" | "displayName">;
  size: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  // A picture that will not load (X moved or removed it) gives way to the
  // initial instead of an empty disc; a new URL gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const uri =
    profile.avatarUrl && profile.avatarUrl !== failed
      ? profile.avatarUrl
      : null;
  return uri ? (
    <Image
      source={{ uri }}
      onError={() => setFailed(uri)}
      accessibilityIgnoresInvertColors
      style={[round, { backgroundColor: colors.surfaceRaised }]}
    />
  ) : (
    <View
      style={[
        m.avatar,
        round,
        { backgroundColor: avatarColor(profile.avatar) },
      ]}
    >
      <Text style={[m.title, { fontSize: size * 0.42 }]}>
        {(profile.displayName || "O")[0]!.toUpperCase()}
      </Text>
    </View>
  );
}
/** The X mark beside a name whose identity comes from X; a tap says so. */
function XBadge({ size = 14 }: { size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="X verified"
      onPress={() => showToast("X verified")}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Icon name="x" size={size} color={colors.ice} fill={colors.ice} />
    </Pressable>
  );
}
function ProfileScreen({ id, active }: { id?: string; active: boolean }) {
  const a = useApp();
  const other = useMobile<Profile>(
    "profile",
    { id: id || "" },
    active && Boolean(id),
  );
  const query = id ? other : a.me;
  const p: Profile | undefined = query.data?.data;
  const own = !id || id === a.me.data?.data.id;
  const [section, setSection] =
    useState<(typeof profileSections)[number]>("Portfolio");
  const hide = own && a.hidden;
  // The two round targets overlap their padding, so the name keeps its
  // width beside the X mark.
  const ownIcons = (
    <View style={[m.row, { gap: 0, marginRight: -8 }]}>
      <IconButton
        quiet
        name="info"
        label="About your public profile"
        onPress={() =>
          a.dialog(
            "Your public profile",
            "Your positions and performance are public.",
          )
        }
      />
      <View style={{ marginLeft: -10 }}>
        <IconButton
          quiet
          name="settings"
          label="Settings"
          onPress={() => a.nav({ type: "settings" })}
        />
      </View>
    </View>
  );
  const textLink = (label: string, onPress: () => void, muted = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Text style={[m.link, muted && { color: colors.muted }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Page compact refresh={() => query.refetch()}>
      {!p && own ? <View style={m.between}>{ownIcons}</View> : null}
      <LoadState query={query} skeleton={<ProfileSkeleton />}>
        {p ? (
          <>
            <View style={[m.row, { gap: 14 }]}>
              <Avatar profile={p} size={56} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    numberOfLines={1}
                    style={[m.heading, { fontSize: 19, flexShrink: 1 }]}
                  >
                    {p.displayName}
                  </Text>
                  {p.xVerified ? <XBadge /> : null}
                </View>
                <Text numberOfLines={1} style={[m.muted, { fontSize: 13 }]}>
                  @{p.username}
                </Text>
              </View>
              {own ? (
                ownIcons
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: p.isFollowing }}
                  onPress={() =>
                    void a.action(
                      "follow",
                      { target: p.id },
                      p.isFollowing ? "DELETE" : "POST",
                    )
                  }
                  style={({ pressed }) => [
                    m.smallButton,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={m.link}>
                    {p.isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              )}
            </View>
            {p.bio ? <Text style={m.text}>{p.bio}</Text> : null}
            {p.xUrl || own ? (
              <View style={[m.row, { gap: 18, flexWrap: "wrap" }]}>
                {p.xUrl
                  ? textLink("X profile", () => a.openLink(p.xUrl!))
                  : null}
                {own
                  ? textLink("Edit profile", () => a.nav({ type: "edit" }))
                  : null}
              </View>
            ) : null}
            <View style={[m.row, { gap: 22 }]}>
              {profileSections.map((x) => (
                <Pressable
                  key={x}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: section === x }}
                  onPress={() => setSection(x)}
                  style={[
                    s.sideOption,
                    section === x && { borderBottomColor: colors.ice },
                  ]}
                >
                  <Text
                    style={[
                      m.text,
                      {
                        fontFamily: fonts.medium,
                        color: section === x ? colors.ice : colors.muted,
                      },
                    ]}
                  >
                    {x}
                  </Text>
                </Pressable>
              ))}
            </View>
            {section === "Portfolio" ? (
              <PortfolioContent
                address={p.wallet}
                active={active}
                hidden={hide}
              />
            ) : (
              <ActivityContent address={p.wallet} active={active} />
            )}
            {!own ? (
              <View style={[m.row, { gap: 18 }]}>
                {textLink(
                  "Report profile",
                  () =>
                    a.dialog(
                      "Report profile",
                      "Report this profile for impersonation or misleading content?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Report",
                          onPress: () =>
                            void a.action("report", {
                              target: p.id,
                              reason: "Impersonation or misleading profile",
                            }),
                        },
                      ],
                    ),
                  true,
                )}
                {textLink(
                  "Block",
                  () =>
                    a.dialog(
                      "Block trader?",
                      "Their profile and activity will be hidden from you.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Block",
                          style: "destructive",
                          onPress: () =>
                            void a
                              .action("block", { target: p.id })
                              .then((r: any) => {
                                if (r) a.back();
                              }),
                        },
                      ],
                    ),
                  true,
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </LoadState>
    </Page>
  );
}

function PortfolioContent({
  address,
  active,
  hidden = false,
}: {
  address: string;
  active: boolean;
  hidden?: boolean;
}) {
  const a = useApp();
  // The wallet's book is the one the app already has when it is the scope
  // (or the only wallet): shown at once, refined by this query.
  const sameBook =
    address === a.scope || (a.scope === "all" && (a.wallets?.length ?? 1) <= 1 && address === a.address);
  const q = useMobile<Portfolio>("portfolio", { address, tz: TZ }, active, undefined, {
    placeholder: sameBook ? a.positions.data : undefined,
  });
  const held = (q.data?.data.holdings ?? []).filter((h) => BigInt(h.raw) > 0n);
  // Dollar stablecoins fold into one Cash row at the top, largest first
  // behind it; the row shows even at zero, so the shape of the list holds.
  const cash = held
    .filter((h) => isCash(h.asset.mint))
    .sort((x, y) => Number(y.valueUsd ?? 0) - Number(x.valueUsd ?? 0));
  const rest = held.filter((h) => !isCash(h.asset.mint));
  return (
    <LoadState query={q}>
      <CashRow
        parts={cash.map((h) => ({
          symbol: CASH_MINTS[h.asset.mint] ?? h.asset.symbol,
          quantity: Number(h.quantity),
        }))}
        totalUsd={cash.reduce((sum, h) => sum + Number(h.valueUsd ?? 0), 0)}
        hidden={hidden}
        onPress={() =>
          a.nav({ type: "asset", mint: cash[0]?.asset.mint ?? USDC })
        }
      />
      {rest.map((h) => (
        <AssetRow
          key={h.asset.mint}
          asset={h.asset}
          holding={h}
          hidden={hidden}
          onPress={() => a.nav({ type: "asset", mint: h.asset.mint })}
        />
      ))}
      {q.data && !rest.length ? <Empty title="No assets yet" plain /> : null}
    </LoadState>
  );
}
function PortfolioScreen({
  address,
  active,
}: {
  address?: string;
  active: boolean;
}) {
  const a = useApp();
  return (
    <Page>
      <Text style={m.muted}>
        Holdings in your OMEN wallet. Connected external wallets are separate.
      </Text>
      <PortfolioContent
        address={address || a.scope}
        active={active}
        hidden={a.hidden}
      />
    </Page>
  );
}
function ActivityRows({ rows }: { rows: Activity[] }) {
  const a = useApp(),
    [expanded, setExpanded] = useState<string | null>(null);
  const names = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    buy: "Bought",
    sell: "Sold",
    dividend: "Dividend",
    drip: "DRIP",
    unknown: "Transfer",
  };
  const icon = (kind: Activity["kind"]): IconName =>
    kind === "dividend"
      ? "reward"
      : kind === "drip"
        ? "payout"
        : kind === "deposit"
          ? "depositTray"
          : kind === "withdrawal"
            ? "withdrawTray"
            : "arrow";
  return (
    <View>
      {rows.map((r) => (
        <View
          key={r.id}
          style={{
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: colors.line,
          }}
        >
          {r.profile ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => a.nav({ type: "profile", id: r.profile!.id })}
              style={{ minHeight: 40, justifyContent: "center" }}
            >
              <Text style={m.link}>@{r.profile.username}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: expanded === r.id }}
            onPress={() =>
              r.drip
                ? a.nav({ type: "dripDetail", row: r })
                : setExpanded(expanded === r.id ? null : r.id)
            }
            style={({ pressed }) => [
              m.row,
              {
                minHeight: 60,
                paddingVertical: 10,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <View style={m.avatar}>
              <Icon
                name={icon(r.kind)}
                size={18}
                color={r.kind === "dividend" ? colors.success : colors.muted}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={m.text}>
                {r.drip ? (
                  <Text style={{ fontFamily: fonts.medium }}>
                    {dripTitle(r)}
                  </Text>
                ) : (
                  <>
                    {names[r.kind]}{" "}
                    <Text style={{ fontFamily: fonts.medium }}>{r.symbol}</Text>
                  </>
                )}
              </Text>
              <Text style={m.muted}>
                {new Date(r.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                ·{" "}
                {new Date(r.timestamp).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {["pending", "failed"].includes(r.status)
                  ? " · " + r.status
                  : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 5 }}>
              <Text style={[m.text, { fontFamily: fonts.medium }]}>
                {a.hidden && r.wallet === a.address ? "••••" : usd(r.usd)}
              </Text>
              <Text style={m.muted}>
                {a.hidden && r.wallet === a.address
                  ? "••••"
                  : Number(r.amount).toLocaleString("en-US", {
                      maximumSignificantDigits: 5,
                    }) +
                    " " +
                    r.symbol}
              </Text>
            </View>
          </Pressable>
          {expanded === r.id ? (
            <View style={{ paddingBottom: space.lg, gap: space.md }}>
              {r.kind === "dividend" ? (
                <Text style={m.muted}>
                  {r.sourceMint
                    ? "Source asset: " + r.sourceMint
                    : "Stonk payout · source token unavailable"}
                </Text>
              ) : null}
              <View style={m.between}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => a.nav({ type: "asset", mint: r.mint })}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={m.link}>View asset</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    a.openLink("https://solscan.io/tx/" + r.signature)
                  }
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={m.link}>{r.status}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
function ActivityContent({
  address,
  dividends,
  active,
  period = "All",
  onlyMint,
  onlyPayout,
}: {
  address: string;
  dividends?: boolean;
  active: boolean;
  period?: string;
  /** Fixes the token filter; the token chips are hidden. */
  onlyMint?: string;
  /** Only dividends paid in this token. */
  onlyPayout?: string;
}) {
  const a = useApp();
  const p: Portfolio | undefined = a.positions.data?.data;
  const [cursor, setCursor] = useState(""),
    [mint, setMint] = useState(onlyMint || ""),
    [pages, setPages] = useState<Activity[]>([]);
  // Dividends show five at a time; "View more" adds five, fetching the next
  // page from the server when the loaded ones run out.
  const [shown, setShown] = useState(5);
  // What to show: the payouts, or what DRIP did with them.
  type What = "all" | "payouts" | "buyback" | "cashout" | "swap";
  const [what, setWhat] = useState<What>("all");
  const whats: [What, string][] = [
    ["all", "All"],
    ["payouts", "Payouts"],
    ["buyback", "Compounds"],
    ["cashout", "Cashouts"],
    ["swap", "Swaps"],
  ];
  const q = useMobile<Activity[]>(
    "activity",
    // The dividends list pages over dividends alone, so "load more" only
    // appears when there are more of them.
    {
      address,
      ...(dividends ? { kind: "dividend" } : {}),
      ...(cursor ? { cursor } : {}),
    },
    active,
  );
  // Pages accumulate behind a "Load more" link; the first page replaces.
  useEffect(() => {
    const page = q.data?.data;
    if (!page) return;
    setPages((prev) => {
      if (!cursor) return page;
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...page.filter((x) => !seen.has(x.id))];
    });
  }, [q.data, cursor]);
  const since =
    period === "24h"
      ? Date.now() - 86400000
      : period === "7d"
        ? Date.now() - 7 * 86400000
        : period === "30d"
          ? Date.now() - 30 * 86400000
          : 0;
  const loaded = pages.length ? pages : (q.data?.data ?? []);
  const rows = loaded.filter(
    (r) =>
      (!dividends || r.kind === "dividend" || r.kind === "drip") &&
      (what === "all" ||
        (what === "payouts" ? r.kind === "dividend" : r.drip?.kind === what)) &&
      // A token's dividends are the payouts it made (its source), not the
      // payout token itself; the chip filter on the Omen tab picks sources too.
      // A drip belongs to the token whose dividends it swapped.
      (!mint || r.sourceMint === mint) &&
      (!onlyPayout ||
        (r.kind === "drip" ? r.drip?.payoutMint : r.mint) === onlyPayout) &&
      Date.parse(r.timestamp) >= since,
  );
  const assetFor = (r: Activity): Asset =>
    p?.holdings.find((h) => h.asset.mint === r.mint)?.asset || {
      ...emptyAsset(r.mint),
      symbol: r.symbol,
      name: r.symbol,
      image: r.image ?? null,
    };
  const next = q.data?.nextCursor;
  return (
    <>
      {/* What the list shows: every payout, or what DRIP did with them. */}
      {dividends ? (
        <View style={{ height: 36, justifyContent: "center" }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 18 }}
          >
            {whats.map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: what === value }}
                onPress={() => setWhat(value)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  justifyContent: "center",
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={[
                    m.text,
                    {
                      fontSize: 13,
                      fontFamily: fonts.medium,
                      color: what === value ? colors.ice : colors.muted,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {loaded.length === 0 && q.isPending ? (
        <SkeletonRows plain />
      ) : loaded.length === 0 && q.isError ? (
        <Empty
          title="Couldn't load right now."
          action="Try again"
          onPress={() => void q.refetch()}
        />
      ) : rows.length ? (
        dividends ? (
          <View>
            {rows.slice(0, shown).map((r) => {
              const asset = assetFor(r);
              const drip: DripRecord | undefined = r.drip;
              const title = drip ? dripTitle(r) : asset.name;
              const detail = drip
                ? drip.marketCap != null
                  ? "At " + usd(drip.marketCap, true) + " MC"
                  : "With " +
                    tokenQtyText(drip.payoutAmount) +
                    " " +
                    drip.payoutSymbol
                : (r.sourceSymbol
                    ? "From " + r.sourceSymbol
                    : r.sourceMint
                      ? "From " + r.sourceMint.slice(0, 5) + "…"
                      : "Source pending") +
                  (["pending", "failed"].includes(r.status)
                    ? " · " + r.status
                    : "");
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    (drip ? title + " with " : "Received ") +
                    r.amount +
                    " " +
                    r.symbol
                  }
                  onPress={() =>
                    drip
                      ? a.nav({ type: "dripDetail", row: r })
                      : a.nav({ type: "asset", mint: r.mint })
                  }
                  style={({ pressed }) => [
                    m.row,
                    {
                      minHeight: 60,
                      paddingVertical: 8,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AssetIcon asset={asset} size={38} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={[m.text, { fontFamily: fonts.medium }]}
                    >
                      {title}
                    </Text>
                    <Text numberOfLines={1} style={m.muted}>
                      {detail}
                    </Text>
                  </View>
                  {/* Amount over the moment it landed, both in the numeric face. */}
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text
                      style={[
                        m.text,
                        {
                          fontFamily: fonts.numericMedium,
                          color: colors.success,
                        },
                      ]}
                    >
                      {a.hidden && r.wallet === a.address
                        ? "••••"
                        : (drip ? "" : "+") +
                          Number(r.amount).toLocaleString("en-US", {
                            maximumSignificantDigits: 6,
                          }) +
                          " " +
                          r.symbol}
                    </Text>
                    <Text style={[m.muted, { fontFamily: fonts.numeric }]}>
                      {new Date(r.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ActivityRows rows={rows} />
        )
      ) : (
        <Empty
          title={dividends ? "No dividends yet" : "No activity to show"}
          plain
        />
      )}
      {dividends ? (
        rows.length > shown || (next && next !== cursor) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setShown((n) => n + 5);
              if (rows.length <= shown + 5 && next && next !== cursor)
                setCursor(next);
            }}
            style={{
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={m.link}>
              {q.isFetching ? "Loading…" : "View more"}
            </Text>
          </Pressable>
        ) : null
      ) : rows.length > 0 && next && next !== cursor ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCursor(next)}
          style={{
            minHeight: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={m.link}>{q.isFetching ? "Loading…" : "Load more"}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

type DripRule = {
  /** The wallet the rule runs in; a token held in two wallets has a rule in each. */
  wallet?: string;
  mint: string;
  kind: "drip" | "drip-from" | string;
  enabled: boolean;
  /** How far the rule is from its next swap (enabled rules only). */
  progress?: { raw: string; usd: number | null; minUsd: number };
  settings?: {
    target?: string;
    payout?: string;
    minUsd?: number;
    last?: {
      at: string;
      status: "swapped" | "waiting" | "failed";
      note?: string;
    } | null;
  };
};
type DripConfig = {
  /** A stock pays its own dividends (the issuer reinvests); `stock` marks those. */
  payouts: { mint: string; symbol: string; stock?: boolean }[];
  feeBps: number;
  minUsd: number;
};
/** The dollar figure a rule's target reads as: cash, a buyback, or a token. */
function ruleWords(
  rule: DripRule | undefined,
  payoutSymbol: string,
  parentMint: string | null,
  symbolOf: (mint: string) => string,
  aggregateOn = false,
): string {
  const target = rule?.enabled ? rule.settings?.target : undefined;
  if (!target)
    return aggregateOn
      ? "Follows the " + payoutSymbol + " rule"
      : "Kept as " + payoutSymbol;
  if (target === USDC) return "Converted to cash";
  if (parentMint && target === parentMint)
    return "Buys back " + symbolOf(parentMint);
  return "Buys " + symbolOf(target);
}
/** What a rule did last, or what it is waiting for; one short line. */
function ruleStatus(rule: DripRule | undefined, minUsd: number): string | null {
  if (!rule?.enabled) return null;
  const last = rule.settings?.last;
  if (last?.status === "swapped")
    return (
      "Last reinvested " +
      new Date(last.at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    );
  if (last?.status === "failed" || last?.status === "waiting")
    return last.note || "Waiting for the next dividend";
  return "Swaps each dividend once it is worth $" + minUsd;
}
/** A small "Manage" link that opens the DRIP flow for one rule. */
function ManageLink({
  onPress,
  label = "Manage",
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + " dividends"}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.manageChip, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[m.text, { fontSize: 13, fontFamily: fonts.medium }]}>
        {label}
      </Text>
    </Pressable>
  );
}
/**
 * Everything the wallet needs about its dividends on one page: the tokens it
 * holds that pay them (with Manage for each), then, per payout token, who
 * pays in it and what each paid this wallet, every row opening the token's
 * page so it can be bought from here. Scoped to one token, the same parts
 * read for that token alone.
 */
function DividendsHub({
  active,
  scope,
  period = "All",
}: {
  active: boolean;
  /** One token's view: the token that pays (source) or the token paid (payout). */
  scope?: { mint: string; symbol: string; role: "source" | "payout" };
  /** The chart's window: the cards' figures cover the same span. */
  period?: string;
}) {
  const a = useApp();
  const config = useMobile<DripConfig>("drip-config", {}, active, 0);
  const rules = useMobile<DripRule[]>("strategies", {}, active, 30000);
  const sources = useMobile<DividendSources>(
    "dividend-sources",
    { address: a.scope, tz: TZ },
    active,
    60000,
  );
  const holdings: Holding[] = a.positions.data?.data.holdings ?? [];
  const held = holdings.filter((h) => {
    try {
      return BigInt(h.raw) > 0n;
    } catch {
      return false;
    }
  });
  const supported = config.data?.data.payouts ?? [];
  const drips = (rules.data?.data ?? []).filter(
    (r) => r.kind === "drip" || r.kind === "drip-from",
  );
  const paidBy = (mint: string) =>
    sources.data?.data.sources.find((x) => x.mint === mint);
  const symbolOf = (mint: string) =>
    held.find((h) => h.asset.mint === mint)?.asset.symbol ??
    supported.find((p) => p.mint === mint)?.symbol ??
    (mint === USDC ? "USDC" : mint.slice(0, 5));
  // The holdings that pay dividends, each with the token it pays in: a
  // Stonk token pays in its payout token; a tokenized stock pays in itself
  // (the issuer reinvests the dividend into the same token).
  const stockMints = new Set(supported.filter((p) => p.stock).map((p) => p.mint));
  const payers = held
    .filter(
      (h) =>
        (h.asset.stonk?.kind === "reward" && h.asset.stonk.payoutMint) ||
        stockMints.has(h.asset.mint),
    )
    .map((h) => ({
      holding: h,
      payoutMint: h.asset.stonk?.payoutMint ?? h.asset.mint,
      payoutSymbol:
        h.asset.stonk?.payoutSymbol ||
        symbolOf(h.asset.stonk?.payoutMint ?? h.asset.mint),
    }))
    .filter(
      (x) =>
        !scope ||
        (scope.role === "source"
          ? x.holding.asset.mint === scope.mint
          : x.payoutMint === scope.mint),
    );
  // The list is the portfolio's; the rules and config only refine rows.
  const loading = a.positions.isPending && !a.positions.data;
  const minUsd = config.data?.data.minUsd ?? 1;
  const ruleFor = (kind: "drip" | "drip-from", mint: string, payout?: string) =>
    drips.find(
      (r) =>
        r.kind === kind &&
        r.mint === mint &&
        (kind === "drip" || r.settings?.payout === payout),
    );
  const manage = (x: (typeof payers)[number]) =>
    a.nav({
      type: "drip",
      kind: "drip-from",
      mint: x.holding.asset.mint,
      symbol: x.holding.asset.symbol,
      payout: x.payoutMint,
      payoutSymbol: x.payoutSymbol,
    });
  // The rule in one word: what each payout becomes.
  const policy = (
    rule: DripRule | undefined,
    parent: string,
    agg: DripRule | undefined,
  ) => {
    const target = rule?.enabled ? rule.settings?.target : undefined;
    const aggTarget = agg?.enabled ? agg.settings?.target : undefined;
    const t = target ?? aggTarget;
    if (!t) return "Keep";
    if (t === USDC) return "Cashout";
    if (t === parent) return "Compound";
    return "Swap for $" + symbolOf(t);
  };
  if (loading)
    return (
      <Section title="Active">
        <View style={[m.panel, { gap: 14 }]}>
          <View style={[m.row, { gap: 12 }]}>
            <Skeleton height={40} circle />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={14} width={90} />
              <Skeleton height={10} width={60} />
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Skeleton height={14} width={52} />
              <Skeleton height={24} width={72} radius={8} />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ height: 20, justifyContent: "center" }}>
              <Skeleton height={10} width={100} />
            </View>
            <View style={s.progressTrack} />
          </View>
        </View>
      </Section>
    );
  return (
    <>
      {scope?.role === "payout" ? null : (
        <Section title="Active">
          {payers.length ? (
            payers.map((x) => {
              const own = ruleFor(
                "drip-from",
                x.holding.asset.mint,
                x.payoutMint,
              );
              const agg = ruleFor("drip", x.payoutMint);
              const supportedPayout = supported.some(
                (p) => p.mint === x.payoutMint,
              );
              const got = paidBy(x.holding.asset.mint);
              // The rule in force for this holding: its own, else the payout's.
              const active = own?.enabled
                ? own
                : agg?.enabled
                  ? agg
                  : undefined;
              const progress = active?.progress;
              const fraction =
                progress && progress.usd != null && progress.minUsd > 0
                  ? Math.max(0, Math.min(1, progress.usd / progress.minUsd))
                  : 0;
              return (
                <View key={x.holding.asset.mint} style={[m.panel, { gap: 14 }]}>
                  {/* Who pays, what it paid, and the rule: one row, two columns. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={x.holding.asset.symbol}
                    onPress={() =>
                      a.nav({ type: "asset", mint: x.holding.asset.mint })
                    }
                    style={({ pressed }) => [
                      m.row,
                      { gap: 12, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <AssetIcon asset={x.holding.asset} size={40} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          m.text,
                          { fontFamily: fonts.medium, fontSize: 16 },
                        ]}
                      >
                        ${x.holding.asset.symbol}
                      </Text>
                      <View style={[m.row, { gap: 6 }]}>
                        <Icon name="payout" size={13} color={colors.muted} />
                        <Text
                          numberOfLines={1}
                          style={[m.muted, { fontSize: 12, lineHeight: 16 }]}
                        >
                          ${x.payoutSymbol}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text
                        style={[
                          m.text,
                          {
                            fontFamily: fonts.numericMedium,
                            fontSize: 16,
                            color: got ? colors.success : colors.muted,
                          },
                        ]}
                      >
                        {got
                          ? a.hidden
                            ? "••••"
                            : usd(got.byPeriod?.[period] ?? got.usd)
                          : "–"}
                      </Text>
                      {/* Until the rules are in, the pill is blank rather
                          than "Keep" corrected a beat later. */}
                      {supportedPayout && rules.isPending && !rules.data ? (
                        <View style={[s.policyPill, { justifyContent: "center" }]}>
                          <Skeleton height={10} width={44} />
                        </View>
                      ) : (
                        <View style={s.policyPill}>
                          <Text
                            style={[
                              m.text,
                              { fontSize: 12, fontFamily: fonts.medium },
                            ]}
                          >
                            {supportedPayout
                              ? policy(own, x.holding.asset.mint, agg)
                              : "DRIP coming soon"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                  {/* The next swap: how far along, on a full-width strip; Manage beside it. */}
                  <View style={{ gap: 8 }}>
                    <View style={[m.between, { gap: 12, height: 20 }]}>
                      <Text
                        numberOfLines={1}
                        style={[
                          m.muted,
                          { fontSize: 12, lineHeight: 16, flexShrink: 1 },
                        ]}
                      >
                        {active && supportedPayout
                          ? a.hidden
                            ? "••••"
                            : usd(progress?.usd ?? 0) +
                              " of " +
                              usd(progress?.minUsd ?? 1)
                          : supportedPayout
                            ? "Not reinvesting"
                            : "DRIP coming soon"}
                      </Text>
                      {supportedPayout ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            "Manage " + x.holding.asset.symbol + " dividends"
                          }
                          onPress={() => manage(x)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            m.row,
                            { gap: 2, opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Text style={[m.link, { color: colors.ice }]}>
                            Manage
                          </Text>
                          <Icon name="chevron" size={14} color={colors.ice} />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={s.progressTrack}>
                      <View
                        style={[
                          s.progressFill,
                          {
                            width: `${active && supportedPayout ? Math.round(fraction * 100) : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[m.muted, { minHeight: 40 }]}>
              {scope
                ? scope.symbol + " is not in your portfolio."
                : "Hold a token that pays dividends and it appears here."}
            </Text>
          )}
        </Section>
      )}
      {scope?.role === "payout" ? (
        <PaidInGroup
          payout={{ mint: scope.mint, symbol: scope.symbol }}
          active={active}
          scoped="payout"
          rule={ruleFor("drip", scope.mint)}
          supported={supported.some((p) => p.mint === scope.mint)}
          minUsd={minUsd}
          held={held}
          paidBy={paidBy}
          symbolOf={symbolOf}
        />
      ) : null}
    </>
  );
}
/**
 * One payout token: what the wallet received in it and the rule for it,
 * then the tokens that pay in it (with what each paid this wallet), each a
 * way into that token's page.
 */
function PaidInGroup({
  payout,
  active,
  scoped,
  rule,
  supported,
  minUsd,
  held,
  paidBy,
  symbolOf,
}: {
  payout: { mint: string; symbol: string; stock?: boolean };
  active: boolean;
  /** On a source's page only the payout's own row shows; on the payout's page the rule row leads the payers. */
  scoped?: "source" | "payout";
  rule: DripRule | undefined;
  supported: boolean;
  minUsd: number;
  held: Holding[];
  paidBy: (mint: string) => DividendSources["sources"][number] | undefined;
  symbolOf: (mint: string) => string;
}) {
  const a = useApp();
  const stock = payout.stock === true;
  // A stock's group lists no payers (it pays itself): nothing to fetch.
  const asset = useMobile<Asset>("asset", { mint: payout.mint }, active && !(stock && scoped !== "payout"), 60000);
  const [all, setAll] = useState(scoped === "payout");
  const payers = asset.data?.data.payers ?? [];
  const payoutAsset: Asset = asset.data?.data ??
    held.find((h) => h.asset.mint === payout.mint)?.asset ?? {
      ...emptyAsset(payout.mint),
      symbol: payout.symbol,
      name: payout.symbol,
    };
  // What the wallet was paid in this token: the sum over the tokens that pay it.
  const received = payers.reduce(
    (sum, p) => sum + Number(paidBy(p.mint)?.usd ?? 0),
    0,
  );
  const shown = all ? payers : payers.slice(0, 4);
  // A rule's own threshold when it set one; the platform minimum otherwise.
  const status = ruleStatus(rule, rule?.progress?.minUsd ?? minUsd);
  return (
    <Section title={scoped === "payout" ? "DRIP" : "Paid in " + payout.symbol}>
      {
        <View style={[m.row, { minHeight: 56, gap: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={payout.symbol}
            onPress={() => a.nav({ type: "asset", mint: payout.mint })}
            style={({ pressed }) => [
              m.row,
              { flex: 1, minWidth: 0, gap: 12, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <AssetIcon asset={payoutAsset} size={38} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text
                numberOfLines={1}
                style={[m.text, { fontFamily: fonts.medium }]}
              >
                {payout.symbol}
              </Text>
              <Text
                numberOfLines={1}
                style={[m.muted, { fontSize: 12, lineHeight: 16 }]}
              >
                {supported
                  ? (status ?? ruleWords(rule, payout.symbol, null, symbolOf))
                  : "DRIP coming soon"}
              </Text>
            </View>
            <Text style={[m.text, { fontFamily: fonts.numericMedium }]}>
              {a.hidden ? "••••" : usd(received)}
            </Text>
          </Pressable>
          {supported ? (
            <ManageLink
              onPress={() =>
                a.nav({
                  type: "drip",
                  kind: "drip",
                  mint: payout.mint,
                  symbol: payout.symbol,
                  payout: payout.mint,
                  payoutSymbol: payout.symbol,
                })
              }
            />
          ) : null}
        </View>
      }
      {scoped === "source" || (stock && scoped !== "payout") ? null : stock ? (
        <Text style={[m.muted, { minHeight: 40 }]}>
          {payout.symbol} pays its dividends in {payout.symbol}: the issuer reinvests them and the balance grows. OMEN can cash that growth out or buy another token with it.
        </Text>
      ) : asset.isPending ? (
        <SkeletonRows count={3} plain />
      ) : (
        <View>
          {scoped === "payout" ? (
            <Text style={[m.heading, { marginTop: 8, marginBottom: 4 }]}>
              Paid by
            </Text>
          ) : null}
          {shown.map((p) => {
            const got = paidBy(p.mint);
            const holding = held.some((h) => h.asset.mint === p.mint);
            return (
              <Pressable
                key={p.mint}
                accessibilityRole="button"
                accessibilityLabel={p.symbol}
                onPress={() => a.nav({ type: "asset", mint: p.mint })}
                style={({ pressed }) => [
                  m.row,
                  {
                    minHeight: 56,
                    paddingVertical: 6,
                    gap: 12,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <AssetIcon
                  asset={{
                    ...emptyAsset(p.mint),
                    symbol: p.symbol || p.mint.slice(0, 5),
                    name: p.symbol || p.mint.slice(0, 5),
                    image: p.image,
                  }}
                  size={34}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={[m.text, { fontFamily: fonts.medium }]}
                  >
                    {p.symbol || p.mint.slice(0, 5) + "…"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[m.muted, { fontSize: 12, lineHeight: 16 }]}
                  >
                    {(p.taxBps === null
                      ? "Pays " + payout.symbol
                      : p.taxBps / 100 + "% tax") + (holding ? " · Held" : "")}
                  </Text>
                </View>
                <Text
                  style={[
                    m.text,
                    {
                      fontFamily: fonts.numericMedium,
                      color: got ? colors.success : colors.muted,
                    },
                  ]}
                >
                  {got ? (a.hidden ? "••••" : usd(got.usd)) : "–"}
                </Text>
                <Icon name="chevron" size={16} color={colors.muted} />
              </Pressable>
            );
          })}
          {!payers.length ? (
            <Text style={[m.muted, { minHeight: 40 }]}>
              No token pays {payout.symbol} yet.
            </Text>
          ) : null}
          {payers.length > shown.length ||
          (all && scoped !== "payout" && payers.length > 4) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAll((v) => !v)}
              style={({ pressed }) => ({
                minHeight: 40,
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={m.link}>
                {all ? "Show fewer" : "Show all " + payers.length}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Section>
  );
}
/**
 * The DRIP flow for one rule: what a payout token's dividends (or one
 * holding's share of them) should become. Four answers; the last opens a
 * search for the token to buy. Save writes the rule and closes.
 */
function DripScreen({
  kind,
  mint,
  symbol,
  payout,
  payoutSymbol,
  active,
}: {
  kind: "drip" | "drip-from";
  mint: string;
  symbol: string;
  payout: string;
  payoutSymbol: string;
  active: boolean;
}) {
  const a = useApp();
  const actions = useChainActions();
  const config = useMobile<DripConfig>("drip-config", {}, active, 0);
  const rules = useMobile<DripRule[]>("strategies", {}, active, 0);
  const holdings: Holding[] = a.positions.data?.data.holdings ?? [];
  const rule = (rules.data?.data ?? []).find(
    (r) =>
      r.kind === kind &&
      r.mint === mint &&
      (kind === "drip" || r.settings?.payout === payout),
  );
  type Choice = "keep" | "buyback" | "cash" | "other";
  const current: { choice: Choice; other: string | null } =
    !rule?.enabled || !rule.settings?.target
      ? { choice: "keep", other: null }
      : rule.settings.target === USDC
        ? { choice: "cash", other: null }
        : kind === "drip-from" && rule.settings.target === mint
          ? { choice: "buyback", other: null }
          : { choice: "other", other: rule.settings.target };
  const [choice, setChoice] = useState<Choice>(current.choice);
  // How much has to pile up before a swap: the platform minimum ($1), or the
  // rule's own figure above it. `custom` is the typed figure, null for the
  // minimum.
  const floorUsd = config.data?.data.minUsd ?? 1;
  const savedMin = Number(rule?.enabled ? rule.settings?.minUsd : NaN);
  const currentMin = Number.isFinite(savedMin) && savedMin > floorUsd ? savedMin : floorUsd;
  const [custom, setCustom] = useState<string | null>(
    currentMin > floorUsd ? String(currentMin) : null,
  );
  const customUsd = custom === null ? null : Number(custom.replace(",", "."));
  const customOk =
    custom === null ||
    (custom.trim() !== "" &&
      Number.isFinite(customUsd) &&
      customUsd! >= floorUsd &&
      customUsd! <= 1_000_000);
  const minUsd =
    custom === null || !customOk ? floorUsd : Math.round(customUsd! * 100) / 100;
  const customField = useRef<TextInput>(null);
  // Opened before the rules had loaded: take the saved answer when they do,
  // unless the user has already picked something.
  const synced = useRef(Boolean(rules.data));
  const [other, setOther] = useState<{
    mint: string;
    symbol: string;
    asset?: Asset;
  } | null>(
    current.other
      ? {
          mint: current.other,
          symbol:
            holdings.find((h) => h.asset.mint === current.other)?.asset
              .symbol ?? current.other.slice(0, 5),
          asset: holdings.find((h) => h.asset.mint === current.other)?.asset,
        }
      : null,
  );
  useEffect(() => {
    if (synced.current || !rules.data) return;
    synced.current = true;
    setChoice(current.choice);
    setCustom(currentMin > floorUsd ? String(currentMin) : null);
    const held = holdings.find((h) => h.asset.mint === current.other)?.asset;
    setOther(
      current.other
        ? {
            mint: current.other,
            symbol: held?.symbol ?? current.other.slice(0, 5),
            asset: held,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.data]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  // Searching fades the page under a blur and brings a live search bar up
  // from the bottom of the screen to the top, so the results have the room;
  // closing runs it back down. The field in the page just hides meanwhile.
  // The docked Save pads by the keyboard's height whenever one is up.
  const [searching, setSearching] = useState(false);
  const [closing, setClosing] = useState(false);
  const lift = useRef(new Animated.Value(0)).current;
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboard(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const openSearch = () => {
    lift.setValue(0);
    setClosing(false);
    setSearching(true);
    Animated.timing(lift, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const closeSearch = () => {
    Keyboard.dismiss();
    // Only the bar rides back down; the results go at once.
    setClosing(true);
    setQ("");
    setSearch("");
    Animated.timing(lift, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSearching(false);
      setClosing(false);
    });
  };
  const results = useMobile<Asset[]>(
    "assets",
    { scope: "stonk", q: search, cursor: "0" },
    active && searching && search.length >= 2,
    0,
  );
  const paste = async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) {
        showErrorToast("Nothing to paste yet.");
        return;
      }
      setQ(text.slice(0, 80));
      if (!searching) openSearch();
    } catch {
      showErrorToast("Could not paste. Please try again.");
    }
  };
  const target =
    choice === "buyback"
      ? mint
      : choice === "cash"
        ? USDC
        : choice === "other"
          ? (other?.mint ?? null)
          : null;
  const changed =
    choice !== current.choice ||
    (choice === "other" && other?.mint !== current.other) ||
    (choice !== "keep" && minUsd !== currentMin);
  const valid =
    choice === "keep"
      ? Boolean(rule)
      : Boolean(target && target !== payout) && customOk;
  const save = async () => {
    if (saving || !changed || !valid) return;
    setSaving(true);
    try {
      const enabled = choice !== "keep";
      // A rule runs in one wallet, where the dividends it reinvests arrive:
      // for a holding, every wallet holding it; for a payout token, every
      // wallet. Switching off reaches every wallet that has the rule.
      const book: Portfolio | undefined = a.positions.data?.data;
      const held =
        book?.holdings
          .find((h) => h.asset.mint === mint)
          ?.wallets?.filter((w) => BigInt(w.raw) > 0n)
          .map((w) => w.address) ?? [];
      const all = book?.wallets?.map((w) => w.address) ?? [];
      const having = (rules.data?.data ?? [])
        .filter((r) => r.kind === kind && r.mint === mint && (kind === "drip" || r.settings?.payout === payout) && r.wallet)
        .map((r) => r.wallet!);
      const targets: (string | undefined)[] = [...new Set(enabled ? (kind === "drip-from" && held.length ? held : all) : having)];
      for (const wallet of targets.length ? targets : [undefined]) {
        // The reinvestor signs on the server with its own narrower signer,
        // attached the first time a rule is switched on.
        if (enabled) await actions.ensureDripSigner(wallet);
        const ok = await a.action("strategies", {
          mint,
          kind,
          enabled,
          ...(wallet ? { wallet } : {}),
          settings: {
            target: enabled ? target : rule?.settings?.target,
            ...(kind === "drip-from" ? { payout } : {}),
            ...(enabled ? { minUsd } : {}),
            includeExisting: true,
          },
        });
        if (!ok) return;
      }
      showToast(
        choice === "keep"
          ? "$" + payoutSymbol + " dividends stay as $" + payoutSymbol
          : choice === "buyback"
            ? "$" +
              payoutSymbol +
              " from $" +
              symbol +
              " will buy back $" +
              symbol
            : choice === "cash"
              ? "$" + payoutSymbol + " dividends will be cashed out to USDC"
              : "$" + payoutSymbol + " dividends will buy $" + other!.symbol,
      );
      a.back();
    } catch (e) {
      showErrorToast(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  // The saved answer is known once the rules have loaded (or the user has
  // picked); before that no option reads as selected.
  const known = Boolean(rules.data) || synced.current;
  const option = (value: Choice, title: string, body: string) => {
    const on = known && choice === value;
    return (
      <Pressable
        key={value}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => {
          synced.current = true;
          setChoice(value);
        }}
        style={({ pressed }) => [
          s.dripOption,
          on && s.dripOptionOn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={[s.dripRadio, on && { borderColor: colors.ice }]}>
          {on ? <View style={s.dripRadioDot} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 15 }]}>
            {title}
          </Text>
          <Text style={[m.muted, { fontSize: 12, lineHeight: 16 }]}>
            {body}
          </Text>
        </View>
      </Pressable>
    );
  };
  // The search pill, drawn in place (a button that opens the search) and
  // again, live, at the top of the overlay.
  const searchBar = (live: boolean) => (
    <View style={[m.row, s.dripSearch]}>
      <Icon name="search" size={16} color={colors.muted} />
      {live ? (
        <Field
          accessibilityLabel="Search an asset"
          placeholder="Search an asset..."
          value={q}
          onChangeText={setQ}
          maxLength={80}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
          style={{
            flex: 1,
            minWidth: 0,
            paddingHorizontal: 0,
            borderWidth: 0,
            backgroundColor: "transparent",
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search an asset"
          onPress={openSearch}
          style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[m.text, { color: colors.muted }]}>
            Search an asset...
          </Text>
        </Pressable>
      )}
      {live && q ? (
        <IconButton
          name="close"
          label="Clear search"
          quiet
          size={14}
          onPress={() => setQ("")}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste an address"
        onPress={() => void paste()}
        style={({ pressed }) => ({
          minHeight: 44,
          minWidth: 48,
          justifyContent: "center",
          alignItems: "center",
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 13 }]}>
          Paste
        </Text>
      </Pressable>
    </View>
  );
  const overlayTop = 12;
  return (
    <View style={{ flex: 1, paddingBottom: keyboard }}>
      <Page compact>
        <Text style={[m.heading, { fontSize: 20, lineHeight: 26 }]}>
          {kind === "drip-from"
            ? "What should happen to $" +
              payoutSymbol +
              " dividends from $" +
              symbol +
              "?"
            : "What should happen to your $" + payoutSymbol + " dividends?"}
        </Text>
        <View style={{ gap: 8 }}>
          {option(
            "keep",
            "Keep",
            "Stays in your portfolio as $" + payoutSymbol,
          )}
          {kind === "drip-from"
            ? option("buyback", "Compound", "Reinvest into $" + symbol)
            : null}
          {/* Dividends already paid in cash have nothing to cash out to. */}
          {payout === USDC ? null : option("cash", "Cashout", "Swap for USDC")}
          {option("other", "Swap", "Pick any other asset")}
          {choice === "other" ? (
            other ? (
              <View
                style={[
                  m.row,
                  { gap: 10, minHeight: 44, paddingHorizontal: 4 },
                ]}
              >
                <AssetIcon
                  asset={
                    other.asset ?? {
                      ...emptyAsset(other.mint),
                      symbol: other.symbol,
                      name: other.symbol,
                    }
                  }
                  size={28}
                />
                <Text style={[m.text, { fontFamily: fonts.medium, flex: 1 }]}>
                  ${other.symbol}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOther(null)}
                  hitSlop={8}
                >
                  <Text style={m.link}>Change</Text>
                </Pressable>
              </View>
            ) : (
              searchBar(false)
            )
          ) : null}
        </View>
        {choice !== "keep" ? (
          <View style={{ gap: 8 }}>
            <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 15 }]}>
              Reinvest once dividends reach
            </Text>
            {/* Two pills: the minimum, and one that is the custom figure's
                own field (tapping it, or typing, picks it). */}
            <View style={[m.row, { gap: 8 }]}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: custom === null }}
                onPress={() => {
                  synced.current = true;
                  Keyboard.dismiss();
                  setCustom(null);
                }}
                style={({ pressed }) => [
                  s.dripPill,
                  custom === null && s.dripOptionOn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[
                    m.text,
                    { fontFamily: fonts.medium, fontSize: 14 },
                    custom !== null && { color: colors.muted },
                  ]}
                >
                  ${floorUsd}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: custom !== null }}
                onPress={() => {
                  synced.current = true;
                  if (custom === null) setCustom("");
                  customField.current?.focus();
                }}
                style={({ pressed }) => [
                  s.dripPill,
                  m.row,
                  { gap: 2, paddingHorizontal: 14 },
                  custom !== null && s.dripOptionOn,
                  custom !== null &&
                    !customOk &&
                    custom.trim() !== "" && { borderColor: colors.error },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[
                    m.text,
                    { fontFamily: fonts.medium, fontSize: 14 },
                    custom === null && { color: colors.muted },
                  ]}
                >
                  $
                </Text>
                <Field
                  ref={customField}
                  accessibilityLabel="Custom amount in dollars"
                  placeholder="Custom"
                  value={custom ?? ""}
                  onFocus={() => {
                    synced.current = true;
                    if (custom === null) setCustom("");
                  }}
                  onChangeText={(t) => {
                    synced.current = true;
                    setCustom(t.replace(/[^0-9.,]/g, "").slice(0, 10));
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                  style={{
                    minWidth: 64,
                    minHeight: 0,
                    paddingVertical: 0,
                    paddingHorizontal: 0,
                    borderWidth: 0,
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    fontFamily: fonts.medium,
                    fontSize: 14,
                    color: custom === null ? colors.muted : colors.mist,
                  }}
                />
              </Pressable>
            </View>
            {custom !== null && !customOk && custom.trim() !== "" ? (
              <Text style={[m.muted, { fontSize: 12, lineHeight: 16, color: colors.error }]}>
                The minimum is ${floorUsd}.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Page>
      {/* Docked under the page: always in reach, never behind the keyboard. */}
      <View
        style={{
          paddingHorizontal: space.edge,
          paddingBottom: space.lg,
          paddingTop: 8,
          gap: 10,
        }}
      >
        <Button
          title="Save"
          busy={saving}
          disabled={!known || !changed || !valid}
          onPress={() => void save()}
        />
        <Text
          style={[
            m.muted,
            { fontSize: 12, lineHeight: 17, textAlign: "center" },
          ]}
        >
          Minimum DRIP is $1.{"\n"}Standard platform fee applies per DRIP.
        </Text>
      </View>
      {searching ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lift }]}>
            <BlurView
              intensity={90}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              onPress={closeSearch}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(7,7,7,0.82)" },
              ]}
            />
          </Animated.View>
          <Animated.View
            style={{
              paddingHorizontal: space.edge,
              paddingTop: overlayTop,
              gap: 8,
              opacity: lift,
              transform: [
                {
                  translateY: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-28, 0],
                  }),
                },
              ],
            }}
          >
            {searchBar(true)}
            {search.length >= 2 && !closing ? (
              <View style={[m.panel, { paddingVertical: 4 }]}>
                {results.isPending ? (
                  <SkeletonRows count={3} plain />
                ) : (
                  (results.data?.data ?? [])
                    .filter((x) => x.mint !== payout)
                    .slice(0, 8)
                    .map((x) => (
                      <Pressable
                        key={x.mint}
                        accessibilityRole="button"
                        accessibilityLabel={"Buy " + x.symbol}
                        onPress={() => {
                          setOther({
                            mint: x.mint,
                            symbol: x.symbol,
                            asset: x,
                          });
                          closeSearch();
                        }}
                        style={({ pressed }) => [
                          m.row,
                          {
                            minHeight: 52,
                            gap: 12,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        <AssetIcon asset={x} size={32} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            numberOfLines={1}
                            style={[m.text, { fontFamily: fonts.medium }]}
                          >
                            ${x.symbol}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[m.muted, { fontSize: 12 }]}
                          >
                            {x.name}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                )}
              </View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
/** "Compound ZCAT", "Cashout ZCAT", "Swap ZCAT": a drip named after the token whose dividends it used. */
const dripTitle = (r: Activity) => {
  const d = r.drip!;
  const of = d.sourceSymbol ?? d.payoutSymbol;
  return (
    (d.kind === "buyback"
      ? "Compound "
      : d.kind === "cashout"
        ? "Cashout "
        : "Swap ") + of
  );
};
const tokenQtyText = (v: string | number) =>
  Number(v).toLocaleString("en-US", { maximumSignificantDigits: 6 });
/**
 * One drip, in full: when it landed, the dividends it used, what they
 * bought and the cap it was bought at, and the transaction.
 */
function DripDetail({ row }: { row: Activity }) {
  const a = useApp();
  const d = row.drip!;
  const p: Portfolio | undefined = a.positions.data?.data;
  const target: Asset = p?.holdings.find((h) => h.asset.mint === row.mint)
    ?.asset ?? {
    ...emptyAsset(row.mint),
    symbol: row.symbol,
    name: row.symbol,
    image: row.image ?? null,
  };
  const when = new Date(row.timestamp);
  const line = (label: string, value: string, onPress?: () => void) => (
    <Pressable
      key={label}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        m.between,
        { minHeight: 48, gap: 12, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[m.muted, { fontSize: 14 }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[
          m.text,
          {
            fontFamily: fonts.numericMedium,
            flexShrink: 1,
            textAlign: "right",
          },
          onPress && { color: colors.ice },
        ]}
      >
        {value}
        {onPress ? " ›" : ""}
      </Text>
    </Pressable>
  );
  return (
    <Page compact>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.symbol}
        onPress={() => a.nav({ type: "asset", mint: row.mint })}
        style={({ pressed }) => [
          m.row,
          { gap: 14, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <AssetIcon asset={target} size={48} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={[m.metric, { fontSize: 24, lineHeight: 30 }]}
          >
            {a.hidden ? "••••" : tokenQtyText(row.amount) + " " + row.symbol}
          </Text>
          <Text style={m.muted}>
            {d.kind === "buyback"
              ? "Bought back"
              : d.kind === "cashout"
                ? "Cashed out"
                : "Bought"}{" "}
            · {a.hidden ? "••••" : usd(row.usd)}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </Pressable>
      <View style={[m.panel, { gap: 0 }]}>
        {line(
          "When",
          when.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }) +
            " · " +
            when.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }),
        )}
        {line(
          "Dividends used",
          a.hidden
            ? "••••"
            : tokenQtyText(d.payoutAmount) + " " + d.payoutSymbol,
          () => a.nav({ type: "asset", mint: d.payoutMint }),
        )}
        {d.sourceSymbol
          ? line("Paid by", d.sourceSymbol, () =>
              a.nav({ type: "asset", mint: d.sourceMint! }),
            )
          : null}
        {line(
          d.kind === "cashout" ? "Cashed out to" : "Bought",
          a.hidden ? "••••" : tokenQtyText(row.amount) + " " + row.symbol,
          () => a.nav({ type: "asset", mint: row.mint }),
        )}
        {d.kind !== "cashout"
          ? line(
              "Market cap at buy",
              d.marketCap != null ? usd(d.marketCap, true) : "—",
            )
          : null}
        {d.kind !== "cashout" && d.price != null
          ? line("Price at buy", assetPrice(d.price))
          : null}
        {line(
          "Transaction",
          row.signature.slice(0, 4) + "…" + row.signature.slice(-4),
          () => a.openLink("https://solscan.io/tx/" + row.signature),
        )}
      </View>
    </Page>
  );
}
/** "-$0.12", "+$3.40" or "$0": a signed dollar figure for a P&L line. */
const signedUsd = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "$0";
  return (n < 0 ? "-" : "+") + usd(Math.abs(n));
};
const pnlTone = (value: string | number | null | undefined) => {
  const n = Number(value ?? 0);
  return !Number.isFinite(n) || n === 0
    ? colors.ice
    : n > 0
      ? colors.success
      : colors.error;
};
/** "All time", "Today" or "Last 7d": the dividends window in words. */
const windowLabel = (period: string) =>
  period === "All" ? "All time" : period === "1d" ? "Today" : "Last " + period;
/** The dividends chart's windows, as the price chart shows its own. */
const dividendPeriods = [
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "All", label: "All" },
];
function ActivityScreen({
  address,
  dividends,
  mint,
  symbol,
  role,
  tab = false,
  active,
}: {
  address?: string;
  dividends?: boolean;
  /** Limits the page to one token: the token that pays (source) or the token paid (payout). */
  mint?: string;
  symbol?: string;
  role?: "source" | "payout";
  /** Shown as the Omen tab: a page title instead of a back row. */
  tab?: boolean;
  active: boolean;
}) {
  const a = useApp();
  // Opens on today: what the wallet was paid since its midnight.
  const [period, setPeriod] = useState("1d");
  const [scrubbing, setScrubbing] = useState(false);
  const [point, setPoint] = useState<DividendPoint | null>(null);
  const wallet = address || a.scope;
  const own = wallet === a.scope;
  const scope =
    mint && symbol ? { mint, symbol, role: role ?? "source" } : undefined;
  // The tab's figure and chart come from one series: dividends per bucket
  // over the window, and their sum.
  const series = useMobile<{
    period: string;
    bucketMs: number;
    points: { time: number; usd: string }[];
    totalUsd: string;
    count: number;
  }>(
    "dividend-series",
    { address: wallet, period, tz: TZ },
    active && Boolean(dividends) && !scope,
    30000,
    { keepPrevious: true },
  );
  const points: DividendPoint[] = (series.data?.data.points ?? []).map((p) => ({
    time: p.time,
    usd: Number(p.usd),
  }));
  const bySource = useMobile<DividendSources>(
    "dividend-sources",
    { address: wallet, tz: TZ },
    active && Boolean(dividends && mint),
    60000,
  );
  const fromThis = bySource.data?.data.sources.find((s) => s.mint === mint);
  // A payout token's figure: what every token paying in it paid this wallet.
  const payoutAsset = useMobile<Asset>(
    "asset",
    { mint: mint || "" },
    active && Boolean(dividends && mint && scope?.role === "payout"),
    60000,
  );
  const inThis = (payoutAsset.data?.data.payers ?? []).reduce(
    (sum, p) =>
      sum +
      Number(
        bySource.data?.data.sources.find((s) => s.mint === p.mint)?.usd ?? 0,
      ),
    0,
  );
  const inThisCount = (payoutAsset.data?.data.payers ?? []).reduce(
    (sum, p) =>
      sum +
      (bySource.data?.data.sources.find((s) => s.mint === p.mint)?.count ?? 0),
    0,
  );
  const figure =
    scope?.role === "payout" ? { usd: inThis, count: inThisCount } : fromThis;
  const figurePending =
    scope?.role === "payout"
      ? payoutAsset.isPending || bySource.isPending
      : bySource.isPending;
  // While a finger is on the chart the figure is that bucket's, dated.
  const bucketLabel = (p: DividendPoint) => {
    const d = new Date(p.time * 1000);
    const day = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return (series.data?.data.bucketMs ?? 0) < 86400000
      ? day +
          " · " +
          d.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
      : day;
  };
  // A token the wallet neither holds nor was ever paid by or in has no
  // page of figures, rules or history to show: one line and the way to
  // buy it, whichever side of the dividends the token is on.
  const holdsIt = (a.positions.data?.data.holdings ?? []).some(
    (h: Holding) => h.asset.mint === mint && BigInt(h.raw || "0") > 0n,
  );
  // Decided from the portfolio the app already has: not held means the
  // empty page at once, no placeholders first. Should the receipts (a
  // slower read) then show the token did pay this wallet, the full page
  // takes over.
  const paidIt = Number(figure?.usd ?? 0) > 0;
  const emptyForToken =
    Boolean(dividends && scope && own && !a.guest) &&
    Boolean(a.positions.data) && !holdsIt && !paidIt;
  if (emptyForToken && scope)
    return (
      <Page compact>
        <View style={[m.row, { gap: 4, marginLeft: -12, minHeight: 44 }]}>
          <IconButton name="back" label="Go back" quiet size={22} onPress={a.back} />
          <Text numberOfLines={1} style={[m.heading, { flex: 1 }]}>
            {scope.symbol} Dividends
          </Text>
        </View>
        <Empty
          plain
          title={scope.symbol + " is not in your portfolio."}
          action={"Buy " + scope.symbol}
          onPress={() => {
            a.setPendingBuy(mint);
            a.back();
          }}
        />
      </Page>
    );
  return (
    <Page compact scrollEnabled={!scrubbing}>
      {dividends ? (
        scope ? (
          <>
            {/* A token's page keeps its title row; the tab has none. */}
            <View style={[m.row, { gap: 4, marginLeft: -12, minHeight: 44 }]}>
              <IconButton
                name="back"
                label="Go back"
                quiet
                size={22}
                onPress={a.back}
              />
              <Text numberOfLines={1} style={[m.heading, { flex: 1 }]}>
                {scope.symbol} Dividends
              </Text>
            </View>
            <View
              style={[m.row, { gap: 10, height: 44, alignItems: "flex-end" }]}
            >
              {figurePending ? (
                <Skeleton
                  height={32}
                  width={140}
                  radius={8}
                  style={{ marginBottom: 4 }}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[m.metric, { fontSize: 32, lineHeight: 40 }]}
                >
                  {own && a.hidden ? "••••" : usd(figure?.usd ?? 0)}
                </Text>
              )}
              <Text
                style={[
                  m.muted,
                  {
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: fonts.numeric,
                    paddingBottom: 7,
                  },
                ]}
              >
                {figure?.count
                  ? "over " +
                    figure.count +
                    " payout" +
                    (figure.count === 1 ? "" : "s")
                  : "No payouts yet"}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* The same title row as a token's page. As a tab there is no
                screen underneath to go back to, so back means Home. */}
            <View style={[m.row, { gap: 4, marginLeft: -12, minHeight: 44 }]}>
              <IconButton
                name="back"
                label="Go back"
                quiet
                size={22}
                onPress={() => (tab ? a.setTab("Home") : a.back())}
              />
              <Text numberOfLines={1} style={[m.heading, { flex: 1 }]}>
                Dividends
              </Text>
            </View>
            {/* The window's dividends, large; under a finger, one bucket's. */}
            <View style={{ height: 58, justifyContent: "flex-end" }}>
              {series.isPending && !series.data ? (
                <Skeleton
                  height={36}
                  width={160}
                  radius={8}
                  style={{ marginBottom: 6 }}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[m.metric, { fontSize: 36, lineHeight: 44 }]}
                >
                  {own && a.hidden
                    ? "••••"
                    : usd(
                        point ? point.usd : (series.data?.data.totalUsd ?? 0),
                      )}
                </Text>
              )}
              <Text
                style={[
                  m.muted,
                  { fontSize: 13, lineHeight: 18, fontFamily: fonts.numeric },
                ]}
              >
                {point
                  ? bucketLabel(point)
                  : series.data
                    ? series.data.data.count +
                      " payout" +
                      (series.data.data.count === 1 ? "" : "s") +
                      " · " +
                      windowLabel(period).toLowerCase()
                    : " "}
              </Text>
            </View>
            <View style={{ opacity: series.isPlaceholderData ? 0.45 : 1 }}>
              <DividendChart
                points={points}
                loading={series.isPending && !series.data}
                onSelect={setPoint}
                onScrubStart={() => setScrubbing(true)}
                onScrubEnd={() => setScrubbing(false)}
              />
            </View>
            <View style={[m.between, { paddingHorizontal: 4 }]}>
              {dividendPeriods.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.value === period }}
                  onPress={() => setPeriod(item.value)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    minWidth: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={[
                      m.text,
                      {
                        fontSize: 13,
                        fontFamily: fonts.medium,
                        color:
                          item.value === period ? colors.ice : colors.muted,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )
      ) : null}
      {dividends && own ? (
        <DividendsHub
          active={active}
          scope={scope}
          period={scope ? "All" : period}
        />
      ) : null}
      {dividends ? (
        <Text style={[m.heading, { marginTop: 4 }]}>History</Text>
      ) : null}
      <ActivityContent
        address={wallet}
        active={active}
        dividends={dividends}
        period="All"
        onlyMint={scope?.role === "source" ? scope.mint : undefined}
        onlyPayout={scope?.role === "payout" ? scope.mint : undefined}
      />
    </Page>
  );
}

function Receive() {
  const a = useApp(),
    [copied, setCopied] = useState(false);
  // The card is as wide as the page, so the QR's size is known before the
  // first frame; nothing appears a beat late and shifts the content.
  const qrWidth = useWindowDimensions().width - 2 * space.edge;
  const p: Portfolio | undefined = a.positions.data?.data;
  // The deposit goes to the wallet the app is on: the one chosen in the
  // switcher, else Main. The address shown, copied and encoded follows.
  const wallets: WalletEntry[] = a.wallets;
  const address =
    a.scope !== "all" && wallets.some((w: WalletEntry) => w.address === a.scope) ? a.scope : a.address;
  // Deposits alone, a page at a time; the next page loads as the list
  // nears its end.
  const [cursor, setCursor] = useState("");
  const [pages, setPages] = useState<Activity[]>([]);
  const activity = useMobile<Activity[]>("activity", {
    address,
    kind: "deposit",
    ...(cursor ? { cursor } : {}),
  });
  useEffect(() => {
    const page = activity.data?.data;
    if (!page) return;
    setPages((prev) => {
      if (!cursor) return page;
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...page.filter((x) => !seen.has(x.id))];
    });
  }, [activity.data, cursor]);
  const received = pages;
  const next = activity.data?.nextCursor;
  const loadMore = () => {
    if (next && next !== cursor && !activity.isFetching) setCursor(next);
  };
  const copy = () =>
    void Clipboard.setStringAsync(address)
      .then(() => setCopied(true))
      .catch(() => showErrorToast("Could not copy address."));
  // "Copied" is an acknowledgement, not a state: the button reads as a
  // copy button again after a couple of seconds.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  // Version 4 (33 modules) always fits a base58 address, so the piece size
  // can be derived from the measured card width.
  const qrPadding = 16;
  const pieceSize = Math.max(2, Math.floor((qrWidth - 2 * qrPadding) / 33));
  const assetFor = (r: Activity): Asset =>
    p?.holdings.find((h) => h.asset.mint === r.mint)?.asset || {
      ...emptyAsset(r.mint),
      symbol: r.symbol,
      name: r.symbol,
      image: r.image ?? null,
    };
  return (
    <Page compact onEndReached={loadMore}>
      <Text style={m.muted}>Send any Solana asset to this address.</Text>
      <View
        style={{
          width: "100%",
          alignItems: "center",
          padding: qrPadding,
          backgroundColor: "#FFFFFF",
          borderRadius: radius.panel,
        }}
      >
        <QRCode
          data={address}
          version={4}
          errorCorrectionLevel="M"
          pieceSize={pieceSize}
        />
      </View>
      <View style={[m.panel, { gap: 6 }]}>
        <View style={m.between}>
          <Text style={m.label}>Address</Text>
          <Text style={m.label}>Solana</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Address copied" : "Copy address"}
          onPress={copy}
          style={({ pressed }) => [
            m.between,
            { minHeight: 40, opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Text
            style={[m.text, { fontSize: 15, fontFamily: fonts.numericMedium }]}
          >
            {shortAddress(address)}
          </Text>
          <Text style={[m.link, copied && { color: colors.success }]}>
            {copied ? "Copied" : "⧉"}
          </Text>
        </Pressable>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={m.heading}>Previous deposits</Text>
        {activity.isPending && !pages.length ? (
          <SkeletonRows count={3} plain />
        ) : received.length ? (
          received.map((r) => {
            const asset = assetFor(r);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={"Received " + r.amount + " " + r.symbol}
                onPress={() => a.nav({ type: "asset", mint: r.mint })}
                style={({ pressed }) => [
                  m.row,
                  {
                    minHeight: 60,
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <AssetIcon asset={asset} size={38} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text
                    numberOfLines={1}
                    style={[m.text, { fontFamily: fonts.medium }]}
                  >
                    {asset.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[m.muted, { fontFamily: fonts.numeric }]}
                  >
                    {r.symbol} ·{" "}
                    {new Date(r.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text
                    style={[
                      m.text,
                      {
                        fontFamily: fonts.numericMedium,
                        color: colors.success,
                      },
                    ]}
                  >
                    {a.hidden
                      ? "••••"
                      : "+" +
                        Number(r.amount).toLocaleString("en-US", {
                          maximumSignificantDigits: 6,
                        }) +
                        " " +
                        r.symbol}
                  </Text>
                  <Text style={[m.muted, { fontFamily: fonts.numeric }]}>
                    {a.hidden ? "••••" : usd(r.usd)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Empty title="No deposits yet" plain />
        )}
        {activity.isFetching && pages.length ? (
          <SkeletonRows count={1} plain />
        ) : null}
      </View>
    </Page>
  );
}

const sendKeys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "del"],
];
function Send({ mint: initialMint }: { mint?: string }) {
  const a = useApp();
  const actions = useChainActions();
  const [sending, setSending] = useState(false);
  const p: Portfolio | undefined = a.positions.data?.data;
  const [mint, setMint] = useState(initialMint || SOL);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [choosing, setChoosing] = useState(false);
  const holdings = p?.holdings || [];
  const assets = [
    ...holdings.map((holding) => holding.asset),
    ...(!holdings.some((holding) => holding.asset.mint === SOL)
      ? [emptyAsset(SOL)]
      : []),
  ];
  const asset = assets.find((item) => item.mint === mint) || emptyAsset(SOL);
  const holding = holdings.find((item) => item.asset.mint === mint);
  // A send comes from one wallet: for a token, the one holding the most of
  // it; for SOL, the one with the most native SOL. Over several wallets
  // what can be sent is that wallet's share, not the book's total.
  const solWallet = [...(p?.wallets ?? [])].sort((x, y) => (BigInt(y.nativeLamports) > BigInt(x.nativeLamports) ? 1 : -1))[0];
  const sendWallet = mint === SOL ? solWallet?.address : walletHolding(holding);
  const sendShare = holding?.wallets?.find((w) => w.address === sendWallet);
  // Sending SOL moves native lamports; the SOL holding is wrapped SOL.
  const available =
    mint === SOL
      ? Number(solWallet?.nativeLamports ?? p?.nativeLamports ?? 0) / 1e9
      : sendShare && (holding?.wallets?.length ?? 0) > 1
        ? Number(sendShare.raw) / 10 ** (holding?.decimals ?? 0)
        : Number(holding?.quantity || 0);
  const availableText = a.hidden
    ? "••••"
    : available.toLocaleString("en-US", { maximumSignificantDigits: 6 });
  const value =
    asset.price !== null && amount ? Number(amount) * asset.price : null;
  // Calculator-style entry: one decimal point, no leading zeros, bounded length.
  const press = (key: string) =>
    setAmount((prev) => {
      if (key === "del") return prev.slice(0, -1);
      if (key === ".") return prev.includes(".") ? prev : (prev || "0") + ".";
      if (prev === "0") return key;
      return prev.length >= 18 ? prev : prev + key;
    });
  const stage = (percent: number) =>
    setAmount(
      percent === 100
        ? String(available)
        : String(Number(((available * percent) / 100).toPrecision(6))),
    );
  const paste = async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) {
        showErrorToast("Nothing to paste yet.");
        return;
      }
      setRecipient(text.slice(0, 44));
    } catch {
      showErrorToast("Could not paste. Please try again.");
    }
  };
  const send = () => {
    if (!isAddress(recipient.trim())) {
      showErrorToast("Enter a valid Solana address.");
      return;
    }
    if (
      !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) ||
      BigInt(amount.replace(".", "")) === 0n
    ) {
      showErrorToast("Enter an amount greater than zero.");
      return;
    }
    if (Number(amount) > available) {
      showErrorToast("That is more than you hold.");
      return;
    }
    if (sending) return;
    setSending(true);
    const to = recipient.trim();
    void (async () => {
      try {
        await actions.transfer({ mint, to, amount, wallet: sendWallet });
        a.dialog(
          "Sent",
          `${amount} ${asset.symbol} sent to ${to.slice(0, 4)}…${to.slice(-4)}.`,
        );
        a.back();
      } catch (e) {
        a.dialog("Send failed", errorMessage(e));
      } finally {
        setSending(false);
      }
    })();
  };
  return (
    <>
      <Page compact scrollEnabled={false}>
        <View style={s.toRow}>
          <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 15 }]}>
            To
          </Text>
          <Field
            accessibilityLabel="Recipient Solana address"
            placeholder="Solana address"
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={44}
            style={[
              s.amountInput,
              {
                flex: 1,
                maxWidth: undefined,
                fontSize: 13,
                fontFamily: fonts.numeric,
                borderBottomWidth: 0,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste address"
            onPress={() => void paste()}
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 13 }]}>
              Paste
            </Text>
          </Pressable>
        </View>
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 4 }}>
          <Text
            accessibilityLabel={
              "Amount " + (amount || "0") + " " + asset.symbol
            }
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              m.metric,
              { fontSize: 48, color: amount ? colors.ice : colors.muted },
            ]}
          >
            {amount || "0"}
          </Text>
          <Text style={[m.muted, { fontFamily: fonts.numeric }]}>
            ≈ {usd(value)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Change asset, currently " + asset.symbol}
            onPress={() => setChoosing(true)}
            style={({ pressed }) => [
              s.assetPill,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <AssetIcon asset={asset} size={22} />
            <Text style={[m.text, { fontFamily: fonts.numericMedium }]}>
              {availableText} {asset.symbol}
            </Text>
            <Icon name="swap" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <View style={[m.row, { justifyContent: "space-between", gap: 0 }]}>
          {[25, 50, 75, 100].map((percent, i) => (
            <React.Fragment key={percent}>
              {i ? <View style={s.pctDivider} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  (percent === 100 ? "Maximum" : percent + " percent") +
                  " of available " +
                  asset.symbol
                }
                onPress={() => stage(percent)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={[
                    m.text,
                    {
                      fontSize: 13,
                      color: colors.mist,
                      fontFamily:
                        percent === 100 ? fonts.medium : fonts.numericMedium,
                    },
                  ]}
                >
                  {percent === 100 ? "Max" : percent + "%"}
                </Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {sendKeys.map((row) => (
            <View key={row.join("")} style={[m.row, { gap: 8 }]}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === "del" ? "Delete" : key}
                  onPress={() => press(key)}
                  style={({ pressed }) => [
                    s.key,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  {key === "del" ? (
                    <Icon name="back" size={22} color={colors.mist} />
                  ) : (
                    <Text
                      style={[
                        m.text,
                        { fontSize: 22, fontFamily: fonts.numericMedium },
                      ]}
                    >
                      {key}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        {sending ? (
          <View
            style={{
              height: 52,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={[m.text, { fontFamily: fonts.medium }]}>
              Sending {asset.symbol}…
            </Text>
          </View>
        ) : (
          <SlideToConfirm label="Send" color={colors.focus} onConfirm={send} />
        )}
      </Page>
      <OmenSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title="Select asset"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
        >
          {assets.map((item) => (
            <AssetRow
              key={item.mint}
              asset={item}
              plain
              holding={holdings.find((h) => h.asset.mint === item.mint)}
              hidden={a.hidden}
              onPress={() => {
                setMint(item.mint);
                setAmount("");
                setChoosing(false);
              }}
            />
          ))}
        </ScrollView>
      </OmenSheet>
    </>
  );
}

function Settings() {
  const a = useApp();
  const actions = useChainActions();
  const [busy, setBusy] = useState(false);
  // A referral code typed after onboarding: the field shows its button once
  // something is in it; a wrong code toasts, a right one becomes the row
  // "Referral code · 20261" with the month it bought.
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const redeem = async () => {
    if (redeeming || !code) return;
    setRedeeming(true);
    try {
      const r = await a.action("referral", { code });
      if (!r) return; // the toast said why; the code stays for another try
      showToast(
        "0% trading fees until " +
          new Date((r as any).data.feeFreeUntil).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
      );
      setCode("");
      void a.me.refetch();
    } finally {
      setRedeeming(false);
    }
  };
  const me = a.me.data?.data;
  // Fee-free trading is always on: OMEN's signer is attached on the first
  // trade and there is no switch for it (2026-09-17).
  useEffect(() => () => a.setLocked(false), []);
  const row = (
    label: string,
    onPress: () => void,
    color: string = colors.ice,
    chevron = true,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        m.between,
        { minHeight: 48, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Text style={[m.text, { fontFamily: fonts.medium, color }]}>{label}</Text>
      {chevron ? <Icon name="chevron" size={16} color={colors.muted} /> : null}
    </Pressable>
  );
  return (
    <Page compact>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Hide balances"
        accessibilityState={{ checked: a.hidden }}
        onPress={a.toggleHidden}
        style={[m.between, { minHeight: 48 }]}
      >
        <Text style={[m.text, { fontFamily: fonts.medium }]}>
          Hide balances
        </Text>
        <View
          style={{
            width: 44,
            height: 26,
            borderRadius: 13,
            padding: 3,
            borderWidth: 1,
            borderColor: a.hidden ? colors.ice : colors.line,
            backgroundColor: a.hidden ? colors.ice : colors.card,
            alignItems: a.hidden ? "flex-end" : "flex-start",
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: a.hidden ? colors.canvas : colors.muted,
            }}
          />
        </View>
      </Pressable>
      {/* The referral code: one 48 px pill whatever its state, so
          typing, applying and the redeemed code never move the page. */}
      <View style={{ gap: 8 }}>
        <Text style={m.label}>Referral</Text>
        <View style={[m.row, s.referralPill]}>
          <Icon name="ticket" size={16} color={colors.muted} />
          {!me ? (
            <Skeleton height={12} width={140} />
          ) : me.referralCode ? (
            <Text
              numberOfLines={1}
              style={[
                m.text,
                { flex: 1, fontFamily: fonts.numericMedium, fontSize: 15 },
              ]}
            >
              {me.referralCode}
              <Text style={[m.muted, { fontSize: 13 }]}>
                {me.feeFreeUntil && Date.parse(me.feeFreeUntil) > Date.now()
                  ? "  ·  0% fees until " +
                    new Date(me.feeFreeUntil).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </Text>
            </Text>
          ) : (
            <>
              <Field
                accessibilityLabel="Referral code"
                placeholder="Enter referral code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={() => void redeem()}
                editable={!redeeming}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                  fontSize: 15,
                  fontFamily: fonts.numericMedium,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Apply referral code"
                disabled={!code || redeeming}
                onPress={() => void redeem()}
                hitSlop={8}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 52,
                  alignItems: "flex-end",
                  justifyContent: "center",
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={[
                    m.text,
                    {
                      fontFamily: fonts.medium,
                      fontSize: 14,
                      color: code && !redeeming ? colors.ice : colors.muted,
                    },
                  ]}
                >
                  {redeeming ? "Applying…" : "Apply"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      <AccountConnections
        onBusyChange={(v) => {
          setBusy(v);
          a.setLocked(v);
        }}
      />
      <WalletsSection
        wallets={a.wallets}
        hidden={a.hidden}
        openImport={a.importPending}
        onOpenedImport={() => a.setImportPending(false)}
        onImport={actions.importKey}
        onRename={actions.renameWallet}
        onBusyChange={(v) => {
          setBusy(v);
          a.setLocked(v);
        }}
      />
      <View>
        <Text style={[m.heading, { marginBottom: 4 }]}>More</Text>
        {row("OMEN on X", () => a.openLink("https://x.com/getomenxyz"))}
        {row("Terms of Service", () => a.openLink("https://getomen.xyz/terms"))}
        {row("Privacy Policy", () => a.openLink("https://getomen.xyz/privacy"))}
      </View>
      <View>
        {row(
          a.signingOut ? "Signing out…" : "Sign out",
          () => void a.onSignOut(),
          colors.ice,
          false,
        )}
        {row(
          "Request account deletion",
          () =>
            a.dialog(
              "Request account deletion?",
              "Your public profile will be hidden while deletion is processed. This does not move or delete wallet funds. Keep access to your wallet before requesting deletion.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Request deletion",
                  style: "destructive",
                  onPress: () =>
                    void a.action("delete-account", {}).then((r: any) => {
                      if (r) showErrorToast(r.data.message);
                    }),
                },
              ],
            ),
          colors.error,
          false,
        )}
      </View>
      <Text style={[m.muted, { textAlign: "center" }]}>
        Omen © All rights reserved
      </Text>
    </Page>
  );
}

// Edit profile follows the flat profile and settings screens: the avatar as
// it will appear, underlined fields with a
// quiet label and a count, and one primary action that only lights up once
// something changed.
function EditProfile() {
  const a = useApp(),
    p: Profile | undefined = a.me.data?.data;
  const [name, setName] = useState(p?.displayName || ""),
    [username, setUsername] = useState(p?.username || ""),
    [bio, setBio] = useState(p?.bio || ""),
    [saving, setSaving] = useState(false);
  // With X linked the handle, name and picture are X's: only the bio is
  // edited here, and the rest reads as it is until X is unlinked.
  const locked = p?.xVerified === true;
  const cleanName = name.trim(),
    cleanUser = username.trim().replace(/^@/, "").toLowerCase();
  const changed = locked
    ? bio.trim() !== (p?.bio || "")
    : cleanName !== (p?.displayName || "") ||
      cleanUser !== (p?.username || "") ||
      bio.trim() !== (p?.bio || "");
  const valid =
    locked || (cleanName.length > 0 && /^[a-z0-9_]{3,24}$/.test(cleanUser));
  const fixed = (label: string, value: string) => (
    <View style={[s.toRow, { borderBottomWidth: 0 }]}>
      <Text
        style={[m.text, { fontFamily: fonts.medium, fontSize: 15, width: 92 }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[m.text, { flex: 1, fontSize: 15, color: colors.mist }]}
      >
        {value}
      </Text>
      <XBadge size={12} />
    </View>
  );
  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    props: React.ComponentProps<typeof Field>,
    max?: number,
  ) => (
    // One row per field, as the Send screen lays out "To": the name leads,
    // the value fills the rest, the count sits at the end when it matters.
    <View
      style={[
        s.toRow,
        { borderBottomWidth: 0 },
        props.multiline
          ? { alignItems: "flex-start", paddingVertical: 12 }
          : null,
      ]}
    >
      <Text
        style={[
          m.text,
          {
            fontFamily: fonts.medium,
            fontSize: 15,
            width: 92,
            paddingTop: props.multiline ? 4 : 0,
          },
        ]}
      >
        {label}
      </Text>
      <Field
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        maxLength={max}
        value={value}
        onChangeText={onChange}
        {...props}
        style={[
          s.amountInput,
          {
            flex: 1,
            maxWidth: undefined,
            fontSize: 15,
            fontFamily: fonts.medium,
            textAlign: "left",
          },
          props.multiline
            ? { minHeight: 64, textAlignVertical: "top", paddingTop: 4 }
            : null,
        ]}
      />
      {max && value.length >= max * 0.8 ? (
        <Text
          style={[
            m.label,
            {
              fontFamily: fonts.numeric,
              fontVariant: ["tabular-nums"],
              fontSize: 11,
            },
            value.length >= max && { color: colors.error },
          ]}
        >
          {value.length}/{max}
        </Text>
      ) : null}
    </View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Page compact>
        <View style={{ alignItems: "center", paddingVertical: 4 }}>
          <Avatar
            profile={{
              avatarUrl: locked ? (p?.avatarUrl ?? null) : null,
              avatar: p?.avatar ?? "",
              displayName: cleanName,
            }}
            size={80}
          />
        </View>
        <View>
          {locked ? (
            <>
              {fixed("Name", p?.displayName || "")}
              {fixed("Username", "@" + (p?.username || ""))}
            </>
          ) : (
            <>
              {field("Name", name, setName, { placeholder: "Your name" }, 40)}
              {field(
                "Username",
                username,
                setUsername,
                {
                  placeholder: "username",
                  autoCapitalize: "none",
                  autoCorrect: false,
                },
                24,
              )}
            </>
          )}
          {field(
            "Bio",
            bio,
            setBio,
            { placeholder: "A little about you", multiline: true },
            160,
          )}
        </View>
        {locked ? (
          <Text style={[m.muted, { fontSize: 12, lineHeight: 17 }]}>
            Your name, username and picture come from X. Unlink X in Settings to
            change them.
          </Text>
        ) : null}
        <Button
          title={saving ? "Saving…" : "Save"}
          busy={saving}
          disabled={!changed || !valid}
          onPress={() => {
            setSaving(true);
            void a
              .action(
                "me",
                locked
                  ? { bio: bio.trim() }
                  : {
                      displayName: cleanName,
                      username: cleanUser,
                      bio: bio.trim(),
                    },
                "PATCH",
              )
              .then((r: any) => {
                if (r) {
                  showToast("Profile saved");
                  a.back();
                }
              })
              .finally(() => setSaving(false));
          }}
        />
      </Page>
    </KeyboardAvoidingView>
  );
}
function PeopleList({
  id,
  direction,
  blocked,
  active,
}: {
  id?: string;
  direction?: string;
  blocked?: boolean;
  active: boolean;
}) {
  const a = useApp(),
    [cursor, setCursor] = useState("0");
  const q = useMobile<Profile[]>(
    blocked ? "blocked" : "relations",
    { ...(id ? { id } : {}), ...(direction ? { direction } : {}), cursor },
    active,
  );
  return (
    <Page>
      <LoadState query={q}>
        {q.data?.data.length ? (
          q.data.data.map((p) => (
            <PersonRow
              key={p.id}
              profile={p}
              onPress={() => {
                if (!blocked) a.nav({ type: "profile", id: p.id });
              }}
              actionLabel={blocked ? "Unblock" : undefined}
              onFollow={
                blocked
                  ? () => void a.action("block", { target: p.id }, "DELETE")
                  : undefined
              }
            />
          ))
        ) : (
          <Empty title={blocked ? "No blocked profiles" : "No profiles yet"} />
        )}
        <Pagination
          cursor={cursor}
          next={q.data?.nextCursor}
          setCursor={setCursor}
        />
      </LoadState>
    </Page>
  );
}
const s = StyleSheet.create({
  balanceCard: { gap: 6, paddingTop: 4, marginBottom: -16 },
  currency: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  assetTile: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: 12,
    gap: 6,
  },
  moveButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
  },
  // The headline price and the stat beside it: one line box each, text on
  // its bottom edge, so the two figures share a baseline at any size.
  figureLine: { height: 40, justifyContent: "flex-end" },
  // 32 px keeps a seven-figure balance ("$1,234,567.89") clear of the eye
  // button and the deposit/withdraw pair beside it on a narrow phone; at 40
  // even "$100,000.00" ran into them and leant on adjustsFontSizeToFit.
  balance: {
    fontFamily: fonts.numericBold,
    fontSize: 32,
    letterSpacing: -0.8,
    color: colors.ice,
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  // Closed dock: two buttons side by side.
  tradeBar: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  tradeButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  // Withdrawing is the quieter of the two cash actions.
  tradeButtonQuiet: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  // Quick amounts: dark grey tiles, the chosen one a shade lighter.
  percentChip: {
    minHeight: 36,
    minWidth: 60,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  percentChipOn: { backgroundColor: "#222222" },
  // Edit profile: an underlined field, no box, so it reads like the rest of
  // the flat profile screens.
  // The fill line the dock shrinks to before closing itself.
  dockResult: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  // The buy/sell switch at the dock's top-left: a quiet round target.
  dockSwitch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tradeDockWrap: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
  },
  tradeDock: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    // Barely-there edge: the shadow and the fade beneath already separate it.
    borderColor: "#131313",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  // Plain-word options; the active one carries a coloured underline.
  sideOption: {
    minHeight: 40,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  // One centred dollar figure; the sign sits beside it, no box.
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    minHeight: 56,
  },
  amountSign: {
    fontFamily: fonts.numericBold,
    fontSize: 34,
    color: colors.ice,
  },
  // The input hugs its digits and aligns them left, so "$" and the figure
  // read as one number instead of a sign floating beside a centred box.
  amountInput: {
    minWidth: 24,
    maxWidth: "70%",
    minHeight: 56,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    fontFamily: fonts.numericBold,
    fontSize: 34,
    textAlign: "left",
  },
  toRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  assetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pctDivider: { width: 1, height: 16, backgroundColor: colors.line },
  key: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
  },
  statToggle: {
    alignItems: "flex-end",
    gap: 2,
    minHeight: 44,
    paddingLeft: 12,
  },
  // The onboarding pages' glyph: bare, the same box on every page.
  onboardGlyph: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  // The referral code as typed, above its keypad.
  onboardCode: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: radius.panel,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  // A min/max field on the filters sheet: the app's card, one line tall.
  filterField: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    color: colors.ice,
    fontSize: 15,
  },
  // "Manage" beside a dividend row: a quiet pill.
  manageChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
  },
  // One answer in the DRIP flow: a slim row on a card.
  dripOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  dripOptionOn: { borderColor: "#4A4B52" },
  // The threshold's two pills: the option card's look, at chip size.
  dripPill: {
    minHeight: 40,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  dripRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dripRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ice,
  },
  // The DRIP flow's search: the Search tab's pill, with Paste at its end.
  dripSearch: {
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 4,
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  // The progress to the next swap, top left of an Active card.
  progressTrack: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.success },
  // The rule in one word on an Active card.
  policyPill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Settings' referral code: the search pill's shape, one line.
  referralPill: {
    height: 48,
    gap: 10,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  // Settings' "Apply" beside the referral field: a small white button.
  settingsApply: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.ice,
    alignItems: "center",
    justifyContent: "center",
  },
  // One key of the referral keypad.
  onboardKey: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    alignItems: "center",
    justifyContent: "center",
  },
  // The onboarding button: the trade buttons' shape in white.
  onboardButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.ice,
    alignItems: "center",
    justifyContent: "center",
  },
  // The token page's fixed header row, same edge as the page below it.
  assetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: space.edge,
    paddingTop: space.sm,
    paddingBottom: 6,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 64,
  },
});
