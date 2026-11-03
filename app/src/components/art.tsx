import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Palette, Spacing, Tones, type ToneName } from '@/constants/theme';
import { Reveal } from '@/motion/reveal';

/**
 * Spot illustrations in the app's own palette: paper on the cream ground, a
 * tinted seal, hairline strokes. Drawn once as vectors so they stay crisp on
 * every screen and cost nothing to ship.
 */

const paper = Palette.surface;
const hairline = Palette.border;
const inkLine = '#D4CFC5';
const check = 'M-6.5 0.5 L-2 5 L7 -5';

function Seal({ cx, cy, r = 16, tone }: { cx: number; cy: number; r?: number; tone: ToneName }) {
  return (
    <G x={cx} y={cy}>
      <Circle r={r} fill={Tones[tone].base} />
      <Path d={check} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
}

/** A receipt in the viewfinder, read and sealed: the empty home, the welcome card. */
export function ReceiptArt({ width = 200 }: { width?: number }) {
  const sage = Tones.sage.base;
  // Zigzag along the bottom edge of the paper.
  let bottom = '';
  for (let x = 138; x > 62; x -= 8) bottom += ` L${x - 4} 123 L${x - 8} 118`;
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 200 160" fill="none">
      <G stroke={sage} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M22 40 V24 H38" />
        <Path d="M162 24 H178 V40" />
        <Path d="M22 120 V136 H38" />
        <Path d="M162 136 H178 V120" />
      </G>
      <Path d={`M62 30 H138 V118${bottom} Z`} fill={paper} stroke={hairline} strokeWidth={1.5} strokeLinejoin="round" />
      <Rect x={74} y={44} width={34} height={6} rx={3} fill={Palette.text} opacity={0.55} />
      <Rect x={74} y={58} width={46} height={5} rx={2.5} fill={inkLine} />
      <Rect x={74} y={70} width={38} height={5} rx={2.5} fill={inkLine} />
      <Rect x={74} y={82} width={42} height={5} rx={2.5} fill={inkLine} />
      <Line x1={74} y1={96} x2={126} y2={96} stroke={hairline} strokeWidth={1.5} strokeDasharray="3 3" />
      <Rect x={74} y={104} width={22} height={6} rx={3} fill={Palette.text} opacity={0.55} />
      <Rect x={104} y={104} width={22} height={6} rx={3} fill={Tones.green.base} />
      <Seal cx={138} cy={116} tone="sage" />
    </Svg>
  );
}

/** Claims landing in a tray and sealed: the approvals queue. */
export function InboxArt({ width = 200 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 200 160" fill="none">
      <G transform="rotate(-8 92 64)">
        <Rect x={64} y={44} width={56} height={40} rx={8} fill={paper} stroke={hairline} strokeWidth={1.5} />
        <Rect x={74} y={56} width={24} height={5} rx={2.5} fill={inkLine} />
        <Rect x={74} y={67} width={34} height={5} rx={2.5} fill={inkLine} />
      </G>
      <G transform="rotate(5 104 76)">
        <Rect x={76} y={56} width={56} height={40} rx={8} fill={paper} stroke={hairline} strokeWidth={1.5} />
        <Rect x={86} y={68} width={28} height={5} rx={2.5} fill={inkLine} />
        <Rect x={86} y={79} width={20} height={5} rx={2.5} fill={inkLine} />
      </G>
      <Path d="M44 98 H156 L148 134 H52 Z" fill={Tones.tan.soft} stroke={Tones.tan.base} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M44 98 L60 80 H140 L156 98" stroke={Tones.tan.base} strokeWidth={1.5} strokeLinejoin="round" fill="none" />
      <Rect x={84} y={110} width={32} height={6} rx={3} fill={Tones.tan.base} opacity={0.5} />
      <Seal cx={146} cy={58} tone="indigo" />
    </Svg>
  );
}

/** A month on a card with its bars, cleared: month-end. */
export function LedgerArt({ width = 200 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 200 160" fill="none">
      <Rect x={44} y={34} width={112} height={100} rx={12} fill={paper} stroke={hairline} strokeWidth={1.5} />
      <Path d="M44 46 a12 12 0 0 1 12 -12 H144 a12 12 0 0 1 12 12 V58 H44 Z" fill={Tones.indigo.soft} />
      <Circle cx={70} cy={34} r={4} fill={Tones.indigo.base} />
      <Circle cx={130} cy={34} r={4} fill={Tones.indigo.base} />
      <Rect x={66} y={88} width={18} height={30} rx={4} fill={Tones.amber.base} />
      <Rect x={91} y={70} width={18} height={48} rx={4} fill={Tones.indigo.base} />
      <Rect x={116} y={78} width={18} height={40} rx={4} fill={Tones.green.base} />
      <Line x1={60} y1={120} x2={140} y2={120} stroke={hairline} strokeWidth={1.5} />
      <Seal cx={152} cy={126} tone="green" />
    </Svg>
  );
}

const STAGES: { label: string; tone: ToneName; icon: SymbolViewProps['name'] }[] = [
  { label: 'Snap', tone: 'sage', icon: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' } },
  { label: 'Submit', tone: 'amber', icon: { ios: 'paperplane.fill', android: 'send', web: 'send' } },
  { label: 'Approve', tone: 'indigo', icon: { ios: 'checkmark.circle.fill', android: 'task_alt', web: 'task_alt' } },
  { label: 'Clear', tone: 'green', icon: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' } },
];

/** The loop every claim goes through, as four sealed stops on a dotted line. Each stop arrives in turn. */
export function Lifecycle({ compact }: { compact?: boolean }) {
  const size = compact ? 40 : 48;
  return (
    <View style={styles.lifecycle}>
      <View style={[styles.rail, { top: size / 2 - 1, left: size / 2, right: size / 2 }]} />
      {STAGES.map((s, i) => (
        <Reveal key={s.label} delay={i * 90} y={6} style={styles.stage}>
          <View style={[styles.stop, { width: size, height: size, borderRadius: size / 2, backgroundColor: Tones[s.tone].base, borderColor: Palette.surface }]}>
            <SymbolView name={s.icon} size={compact ? 18 : 22} tintColor="#FFFFFF" />
          </View>
          <ThemedText type="smallSemi" style={{ color: Tones[s.tone].ink }}>
            {s.label}
          </ThemedText>
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lifecycle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: Spacing.one },
  rail: { position: 'absolute', height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: Palette.border },
  stage: { alignItems: 'center', gap: Spacing.one + Spacing.half },
  stop: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
});
