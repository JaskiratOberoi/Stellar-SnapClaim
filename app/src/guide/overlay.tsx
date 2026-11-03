import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { InboxArt, LedgerArt, Lifecycle, ReceiptArt } from '@/components/art';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, SidebarWidth, Spacing } from '@/constants/theme';
import { useGuide, type Rect } from '@/guide/guide';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';

const PAD = 8;
const RING = 2;
const GAP = 14;
const MARGIN = 16;
const CARD_MAX = 380;
const native = Platform.OS !== 'web';

/**
 * The coach layer over the whole app. A tour step points at a registered
 * control: the page dims except for a rounded window around it, the window
 * glides from one control to the next, and a card with the step's words sits
 * under or over it. A step without a target is a centred card with its art.
 */
export function GuideOverlay() {
  const theme = useTheme();
  const guide = useGuide();
  const { active, index } = guide;
  const step = active?.steps[index];
  const target = step?.target;
  const { width, height } = useWindowDimensions();
  // The measured rectangle is remembered with the step it belongs to, so a new step starts from nothing.
  const stepKey = active ? `${active.id}:${index}` : '';
  const [measured, setMeasured] = useState<{ key: string; rect: Rect } | null>(null);
  // The card's height belongs to its step; a new step measures afresh before it is placed.
  const [cardSize, setCardSize] = useState<{ key: string; h: number } | null>(null);
  const rect = target && measured?.key === stepKey ? measured.rect : null;
  const cardH = cardSize?.key === stepKey ? cardSize.h : 0;
  // On a phone the tab bar owns the bottom of the window.
  const bottomSafe = height - (width < SidebarWidth ? 88 : MARGIN);
  // Animated values live for the overlay's life; useState keeps them out of render-time ref reads.
  const [spot] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [size] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [dim] = useState(() => new Animated.Value(0));
  const placed = useRef(false);

  // Measure the target; scroll it into view first when it sits off-screen; then
  // keep following it, so the window stays on it through the scroll settling,
  // the person scrolling underneath, or the window changing size.
  useEffect(() => {
    if (!active || !target) return;
    const key = stepKey;
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const same = (a: Rect, b: Rect) => Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
    (async () => {
      let first: Rect | null = null;
      for (let tries = 0; tries < 12 && !first && !cancelled; tries++) {
        first = await guide.measure(target);
        if (!first) await wait(80);
      }
      if (!first || cancelled) return;
      let r: Rect = first;
      const room = Math.min(320, height * 0.45);
      const top = 72;
      let dy = 0;
      if (r.y + r.height > height - room) dy = r.y + r.height - (height - room);
      else if (r.y < top) dy = r.y - top;
      if (dy !== 0 && guide.scrollTargetBy(target, dy)) {
        // The scroll is smooth and its length unknown: wait until the target has moved and stopped.
        let moved = false;
        for (let still = 0, tries = 0; (!moved || still < 2) && tries < 18 && !cancelled; tries++) {
          await wait(100);
          const now = (await guide.measure(target)) ?? r;
          if (!same(now, r)) moved = true;
          still = same(now, r) ? still + 1 : 0;
          r = now;
        }
      }
      if (cancelled) return;
      setMeasured({ key, rect: r });
      while (!cancelled) {
        await wait(160);
        const now = await guide.measure(target);
        if (now && !same(now, r)) {
          r = now;
          setMeasured({ key, rect: now });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, index, target, stepKey, guide, height, width]);

  // The window glides to each new target; the first one simply appears.
  useEffect(() => {
    if (!rect) {
      placed.current = false;
      return;
    }
    const to = { x: rect.x - PAD, y: rect.y - PAD };
    const dims = { x: rect.width + PAD * 2, y: rect.height + PAD * 2 };
    if (!placed.current) {
      spot.setValue(to);
      size.setValue(dims);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(spot, { toValue: to, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
      Animated.spring(size, { toValue: dims, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.9 }),
    ]).start();
  }, [rect, spot, size]);

  useEffect(() => {
    Animated.timing(dim, { toValue: active ? 1 : 0, duration: active ? 320 : 180, useNativeDriver: false }).start();
  }, [active, dim]);

  if (!active || !step) return null;

  const total = active.steps.length;
  const last = index === total - 1;
  const cardW = Math.min(CARD_MAX, width - MARGIN * 2);
  const cx = rect ? rect.x + rect.width / 2 : width / 2;
  const left = Math.round(Math.min(Math.max(MARGIN, cx - cardW / 2), width - MARGIN - cardW));
  const below = rect ? rect.y + rect.height + PAD + GAP + cardH <= bottomSafe || rect.y - PAD - GAP - cardH < MARGIN : true;
  const cardTop = rect ? (below ? rect.y + rect.height + PAD + GAP : rect.y - PAD - GAP - cardH) : undefined;
  const pointerX = Math.min(Math.max(cx - left - 7, 20), cardW - 34);
  const ready = !target || rect !== null;

  const art = step.art === 'welcome' ? <ReceiptArt width={180} /> : step.art === 'inbox' ? <InboxArt width={180} /> : step.art === 'ledger' ? <LedgerArt width={180} /> : step.art === 'lifecycle' ? <Lifecycle compact /> : null;

  const card = (
    <View
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      onLayout={(e) => setCardSize({ key: stepKey, h: e.nativeEvent.layout.height })}
      style={[styles.card, { width: cardW, backgroundColor: theme.surface, shadowColor: theme.shadow }, rect ? { position: 'absolute', left, top: cardTop ?? 0, opacity: cardH ? 1 : 0 } : styles.cardCentred]}>
      {rect ? <View style={[styles.pointer, { backgroundColor: theme.surface, left: pointerX }, below ? styles.pointerUp : styles.pointerDown]} /> : null}
      {art ? <View style={step.art === 'lifecycle' ? styles.lifecycle : styles.art}>{art}</View> : null}
      <ThemedText type="serifSmall">{step.title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.body}>
        {step.body}
      </ThemedText>
      <View style={styles.foot}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${total}`}>
          {active.steps.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border, width: i === index ? 18 : 6 }]} />
          ))}
        </View>
        <View style={styles.buttons}>
          {index === 0 ? <Button title="Skip" variant="ghost" compact onPress={guide.skip} /> : <Button title="Back" variant="ghost" compact onPress={guide.back} />}
          <Button
            title={last ? (step.action?.label ?? 'Done') : index === 0 && !target ? 'Show me' : 'Next'}
            compact
            icon={last ? undefined : { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            onPress={() => {
              if (last && step.action) {
                guide.skip();
                step.action.onPress();
              } else guide.next();
            }}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {rect && !native ? (
        // One rounded window; its shadow dims everything else.
        <Animated.View pointerEvents="none" style={[styles.window, { left: spot.x, top: spot.y, width: size.x, height: size.y, borderColor: theme.accent, opacity: dim, boxShadow: `0 0 0 9999px ${theme.scrim}` } as object]} />
      ) : null}
      {rect && native ? (
        <>
          <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: dim, top: 0, left: 0, right: 0, height: spot.y }]} />
          <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: dim, top: Animated.add(spot.y, size.y), left: 0, right: 0, bottom: 0 }]} />
          <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: dim, top: spot.y, left: 0, width: spot.x, height: size.y }]} />
          <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: dim, top: spot.y, left: Animated.add(spot.x, size.x), right: 0, height: size.y }]} />
          <Animated.View pointerEvents="none" style={[styles.window, { left: spot.x, top: spot.y, width: size.x, height: size.y, borderColor: theme.accent, opacity: dim }]} />
        </>
      ) : null}
      {!rect ? <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: ready ? dim : 0 }]} /> : null}
      {/* Touches stop here while the tour is up; the card's buttons and Escape drive it. */}
      <View style={StyleSheet.absoluteFill} />
      {ready ? (
        <View style={[StyleSheet.absoluteFill, !rect && styles.centre]} pointerEvents="box-none">
          <Presence key={`${active.id}-${index}`} visible y={10} style={rect ? undefined : styles.centred}>
            {card}
          </Presence>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute' },
  window: { position: 'absolute', borderRadius: Radius.medium, borderWidth: RING },
  centre: { alignItems: 'center', justifyContent: 'center', padding: MARGIN },
  centred: { alignItems: 'center' },
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three + Spacing.one,
    gap: Spacing.two,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  cardCentred: {},
  pointer: { position: 'absolute', width: 14, height: 14, transform: [{ rotate: '45deg' }], borderRadius: 2 },
  pointerUp: { top: -7 },
  pointerDown: { bottom: -7 },
  art: { alignItems: 'center', paddingBottom: Spacing.one },
  lifecycle: { paddingBottom: Spacing.two, paddingHorizontal: Spacing.one },
  body: { lineHeight: 24 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingTop: Spacing.two, flexWrap: 'wrap' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
