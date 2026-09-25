import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInstalledWallets } from '../../modules/omen-wallets';
import { walletChoices, type WalletChoice } from '../lib/wallet-picker';
import { showErrorToast } from '../lib/toast';
import { colors, fonts } from '../theme';

type Props = { visible: boolean; selected: WalletChoice | null; onClose: () => void; onSelect: (wallet: WalletChoice) => void; dismissible?: boolean };
export function WalletPicker({ visible, selected, onClose, onSelect, dismissible = true }: Props) {
  const [wallets, setWallets] = useState<WalletChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const [presented, setPresented] = useState(visible);
  const [modalReady, setModalReady] = useState(false);
  const [sheetReady, setSheetReady] = useState(false);
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(new Animated.Value(height)).current;
  const sheetHeight = useRef(height);
  const freshPresentation = useRef(true);
  const requestedVisible = useRef(visible);
  requestedVisible.current = visible;

  useEffect(() => {
    if (visible) setPresented(true);
  }, [visible]);

  useEffect(() => {
    if (!presented || !modalReady || !sheetReady) return;
    if (freshPresentation.current) {
      sheetOffset.setValue(sheetHeight.current);
      backdropOpacity.setValue(0);
      freshPresentation.current = false;
    }
    // The backdrop stays full-screen; only the sheet moves. Keep the modal
    // mounted through dismissal so neither layer disappears mid-animation.
    const transition = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: reduceMotion ? 0 : visible ? 140 : 120,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetOffset, {
        toValue: visible ? 0 : sheetHeight.current,
        duration: reduceMotion ? 0 : visible ? 180 : 140,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    transition.start(({ finished }) => {
      if (finished && !requestedVisible.current) {
        setPresented(false);
        setModalReady(false);
        setSheetReady(false);
        freshPresentation.current = true;
      }
    });
    return () => transition.stop();
  }, [visible, presented, modalReady, sheetReady, reduceMotion, backdropOpacity, sheetOffset]);
  const insets = useSafeAreaInsets();
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const installed = await getInstalledWallets();
      if (id === request.current) setWallets(walletChoices(installed,
        Platform.OS === 'android' ? Platform.constants.Model : undefined));
    } catch {
      if (id === request.current) {
        setFailed(true);
        showErrorToast('Couldn’t check your wallets. Please retry.');
      }
    } finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!visible) return;
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && !selected) void refresh();
    });
    return () => { request.current++; listener.remove(); };
  }, [visible, selected, refresh]);
  return (
    <Modal visible={presented} transparent animationType="none" statusBarTranslucent
      onShow={() => setModalReady(true)}
      onRequestClose={() => { if (dismissible) onClose(); }}>
      <View style={s.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close wallet picker" accessibilityRole="button"
          disabled={!dismissible} onPress={onClose} />
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: sheetOffset }] }]}
          pointerEvents={visible ? 'auto' : 'none'}
          onLayout={event => { sheetHeight.current = event.nativeEvent.layout.height; setSheetReady(true); }}
          accessibilityViewIsModal>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title} accessibilityRole="header">Choose your wallet</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close wallet picker" hitSlop={12}
              disabled={!dismissible} onPress={onClose} style={s.close}>
              <Text style={s.closeText}>×</Text>
            </Pressable>
          </View>
          <Text style={s.description}>{selected ? 'Approve the connection request in your wallet.' : 'Available on this device'}</Text>
          {selected ? <View style={s.waiting}><ActivityIndicator color={colors.ice} /><Text style={s.name}>Opening {selected.name}…</Text></View> :
            loading ? <ActivityIndicator style={s.loading} color={colors.ice} /> :
            <ScrollView style={s.list} contentContainerStyle={{ gap: 10 }}>
              {wallets.map(wallet => <Pressable key={wallet.packageName} testID={'wallet-option-' + wallet.packageName}
                accessibilityRole="button" accessibilityLabel={'Connect ' + wallet.name}
                onPress={() => onSelect(wallet)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
                {wallet.icon ? <Image source={{ uri: wallet.icon }} style={s.icon} /> : <View style={[s.icon, s.placeholder]}><Text style={s.name}>{wallet.name[0]}</Text></View>}
                <View style={{ flex: 1, gap: 3 }}><Text style={s.name}>{wallet.name}</Text>{wallet.seeker && <Text style={s.small}>Seeker wallet</Text>}</View>
                <Text style={s.arrow}>›</Text>
              </Pressable>)}
              {!wallets.length && <View style={s.empty}><Text style={s.name}>{failed ? 'Couldn’t load wallets' : 'No compatible wallets found'}</Text><Text style={s.description}>{failed ? 'Try checking again.' : 'Install a Solana wallet, then return here to connect.'}</Text></View>}
            </ScrollView>}
          {!selected && <Pressable onPress={() => void refresh()} disabled={loading} accessibilityRole="button" style={s.refresh}><Text style={s.small}>Refresh wallets</Text></Pressable>}
          {selected && dismissible && <Pressable onPress={onClose} accessibilityRole="button" style={s.refresh}><Text style={s.small}>Cancel</Text></Pressable>}
        </Animated.View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,2,18,0.65)' },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 26, maxHeight: '76%', borderWidth: 1, borderColor: colors.line },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginTop: 12, marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 23, color: colors.ice, flexShrink: 1 },
  close: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.mist, fontSize: 30, lineHeight: 34 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8 },
  list: { marginTop: 24, flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  pressed: { backgroundColor: colors.surfaceRaised },
  icon: { width: 44, height: 44, borderRadius: 12 },
  placeholder: { backgroundColor: colors.cobalt, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 16, color: colors.ice },
  small: { fontFamily: fonts.regular, fontSize: 13, color: colors.mist },
  arrow: { fontSize: 26, color: colors.muted },
  empty: { paddingVertical: 14, gap: 2 },
  loading: { paddingVertical: 40 },
  waiting: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 36 },
  refresh: { alignSelf: 'center', padding: 18, marginTop: 10 },
});
