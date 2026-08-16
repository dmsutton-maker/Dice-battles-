import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { ColorDef, PRISONER_COLORS, PrisonerColorId } from '../game/colors';
import { TUNING } from '../game/tuning';
import { DiceScene, SceneControls } from './DiceScene';

/**
 * Dice demo screen: full-screen castle arena with a gesture overlay.
 *
 * - Touch down anywhere = throw (instant, so rapid tapping = rolling frenzy).
 * - Release with speed = directional flick that steers the throw.
 * - Rolling both dice the same color rescues that prisoner from the far
 *   battlement. Rescue all six to win; the next tap starts a fresh battle.
 */
export function DiceDemoScreen() {
  const controlsRef = useRef<SceneControls | null>(null);
  const [rolledFaces, setRolledFaces] = useState<ColorDef[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [freedOrder, setFreedOrder] = useState<PrisonerColorId[]>([]);
  const [won, setWon] = useState(false);
  const [shakeSignal, setShakeSignal] = useState(0);

  // Refs mirroring state that gesture callbacks need synchronously.
  const wonRef = useRef(false);
  const freedRef = useRef<PrisonerColorId[]>([]);

  const handleThrow = useCallback(() => {
    setRolling(true);
    setRolledFaces(null);
  }, []);

  const handleSettled = useCallback((faces: ColorDef[]) => {
    setRolling(false);
    setRolledFaces(faces);
    const isMatch = faces.length === 2 && faces[0].id === faces[1].id;
    if (!isMatch) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }
    const color = faces[0].id;
    if (freedRef.current.includes(color)) {
      // Already rescued this color — Classic mode: nothing happens.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }
    const next = [...freedRef.current, color];
    freedRef.current = next;
    setFreedOrder(next);
    setShakeSignal((s) => s + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (next.length === PRISONER_COLORS.length) {
      wonRef.current = true;
      setWon(true);
    }
  }, []);

  const resetBattle = useCallback(() => {
    wonRef.current = false;
    freedRef.current = [];
    setWon(false);
    setFreedOrder([]);
    setRolledFaces(null);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Throw on touch-down so rapid tapping feels instant.
      onPanResponderGrant: () => {
        if (wonRef.current) {
          resetBattle();
        }
        controlsRef.current?.throwAll();
      },
      // A fast release re-throws as a directional flick.
      onPanResponderRelease: (_event, gesture) => {
        const speed = Math.hypot(gesture.vx, gesture.vy);
        if (speed < TUNING.throw.flickThreshold) return;
        const scale = TUNING.throw.flickScale;
        const max = TUNING.throw.flickMaxSpeed;
        const clamp = (v: number) => Math.max(-max, Math.min(max, v));
        controlsRef.current?.throwAll({
          x: clamp(gesture.vx * scale),
          // Screen up (negative vy) throws away from the player (-z).
          z: clamp(gesture.vy * scale),
        });
      },
    }),
  ).current;

  const isMatch =
    rolledFaces !== null &&
    rolledFaces.length === 2 &&
    rolledFaces[0].id === rolledFaces[1].id;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 10.5, 5.6], fov: 46 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, -0.2);
        }}
      >
        <color attach="background" args={['#2a2145']} />
        <DiceScene
          controlsRef={controlsRef}
          onThrow={handleThrow}
          onSettled={handleSettled}
          freedOrder={freedOrder}
          shakeSignal={shakeSignal}
        />
      </Canvas>

      {/* Gesture layer (transparent, above the canvas). */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* HUD */}
      <View pointerEvents="none" style={styles.hud}>
        <Text style={styles.title}>DICE BATTLES</Text>
        <Text style={styles.rescueCount}>
          {freedOrder.length} / {PRISONER_COLORS.length} RESCUED
        </Text>
        <View style={styles.resultRow}>
          {rolledFaces ? (
            <>
              {rolledFaces.map((face, i) => (
                <View
                  key={i}
                  style={[styles.swatch, { backgroundColor: face.hex }]}
                />
              ))}
              <Text style={[styles.resultText, isMatch && styles.matchText]}>
                {isMatch
                  ? `${rolledFaces[0].label.toUpperCase()} RESCUED!`
                  : `${rolledFaces[0].label} · ${rolledFaces[1].label}`}
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>
              {rolling ? 'Rolling…' : 'Tap to roll · flick to throw'}
            </Text>
          )}
        </View>
      </View>

      {/* Win overlay */}
      {won && (
        <View pointerEvents="none" style={styles.winOverlay}>
          <Text style={styles.winTitle}>ALL PRISONERS FREED!</Text>
          <Text style={styles.winSubtitle}>Tap to battle again</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2145',
  },
  canvas: {
    flex: 1,
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  rescueCount: {
    color: '#ffd23d',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    minHeight: 30,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  resultText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  matchText: {
    color: '#ffd23d',
    fontWeight: '900',
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    fontWeight: '500',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,12,40,0.55)',
  },
  winTitle: {
    color: '#ffd23d',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  winSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});
