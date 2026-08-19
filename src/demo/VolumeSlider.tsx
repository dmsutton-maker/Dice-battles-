import React, { useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fillPercent,
  knobLeft,
  volumeFromTouch,
  volumeIcon,
  volumeLabel,
} from '../audio/slider';

/**
 * A volume slider, drawn and driven in plain React Native.
 *
 * Deliberately NOT a native slider package: the game ships to players as
 * over-the-air updates, and anything with native code would sit unused
 * until they installed a whole new build from the App Store.
 *
 * It answers a touch anywhere on the bar, not just on the knob — a young
 * player aiming at a 20-point circle mostly misses, and landing next to it
 * should set the volume rather than do nothing.
 */
interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Marks the master slider, which is drawn a little louder itself. */
  emphasis?: boolean;
}

export function VolumeSlider({
  label,
  value,
  onChange,
  emphasis = false,
}: VolumeSliderProps) {
  // The PanResponder is built once, so it reads the live width and the
  // live callback through refs rather than closing over stale props.
  const widthRef = useRef(0);
  const stripRef = useRef<View>(null);
  const originRef = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(() => {
    /**
     * `locationX` is measured against whichever view the touch is IN, so
     * once a drag wandered onto the knob or the fill it started reporting
     * against that child instead of the strip and the value jumped about.
     * That was the glitchiness. The children are now pointerEvents="none"
     * so the strip is always the target, and moves are measured from the
     * strip's own left edge via pageX.
     */
    const setFrom = (event: GestureResponderEvent) => {
      const { pageX, locationX } = event.nativeEvent;
      const originX = originRef.current;
      const x = originX === null ? locationX : pageX - originX;
      onChangeRef.current(volumeFromTouch(x, widthRef.current));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The settings panel does not scroll, so the slider can claim the
      // gesture outright and keep it while the finger wanders off the bar.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: setFrom,
      onPanResponderMove: setFrom,
    });
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
    // Page position of the strip's left edge, so a drag can be measured
    // against the strip no matter what is under the finger.
    stripRef.current?.measure((_x, _y, _w, _h, pageX) => {
      if (Number.isFinite(pageX)) originRef.current = pageX;
    });
  };

  const muted = value <= 0;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={[styles.label, emphasis && styles.labelEmphasis]}>
          {volumeIcon(value)} {label}
        </Text>
        <Text style={[styles.value, muted && styles.valueMuted]}>
          {volumeLabel(value)}
        </Text>
      </View>
      {/* The whole strip is the touch target; the bar inside is the picture. */}
      <View
        ref={stripRef}
        style={styles.touchStrip}
        onLayout={onLayout}
        {...responder.panHandlers}
      >
        <View style={styles.track} pointerEvents="none">
          <View
            style={[
              styles.fill,
              { width: fillPercent(value) },
              emphasis && styles.fillEmphasis,
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[styles.knob, { left: knobLeft(value, width, KNOB) }]}
        />
      </View>
    </View>
  );
}

const KNOB = 22;

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  labelEmphasis: {
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  value: {
    color: '#ffe521',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 46,
    textAlign: 'right',
  },
  valueMuted: {
    color: 'rgba(255,255,255,0.45)',
  },
  touchStrip: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#33cc6b',
  },
  fillEmphasis: {
    backgroundColor: '#ffe521',
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
    // No negative margin: knobLeft already keeps the whole knob on the
    // track, so it can no longer hang off the ends of the panel.
  },
});
