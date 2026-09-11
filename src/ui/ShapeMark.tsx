import React from 'react';
import { View } from 'react-native';
import { SymbolId } from '../game/colorblind';

/**
 * The colourblind shapes, drawn with plain Views.
 *
 * The dice build theirs as textures (src/dice/symbols.ts) because they go
 * onto a 3D face. Here a handful of borders and rotations gets the same
 * silhouette without dragging a texture painter into a menu — the point is
 * that the shape a player sees in the tutorial is the shape they will look
 * for on the table.
 */
export function ShapeMark({ symbol, size }: { symbol: SymbolId; size: number }) {
  const ink = 'rgba(0,0,0,0.62)';
  if (symbol === 'circle') {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink }} />;
  }
  if (symbol === 'square') {
    return <View style={{ width: size * 0.9, height: size * 0.9, backgroundColor: ink }} />;
  }
  if (symbol === 'diamond') {
    return (
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          backgroundColor: ink,
          transform: [{ rotate: '45deg' }],
        }}
      />
    );
  }
  if (symbol === 'triangle') {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.5,
          borderRightWidth: size * 0.5,
          borderBottomWidth: size * 0.86,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: ink,
        }}
      />
    );
  }
  if (symbol === 'hexagon') {
    // Close enough at this size: a wide rounded slab reads as the hexagon
    // it stands for, and nobody is telling them apart by corner count.
    return (
      <View
        style={{
          width: size,
          height: size * 0.78,
          borderRadius: size * 0.18,
          backgroundColor: ink,
        }}
      />
    );
  }
  // Star: two crossed bars is the silhouette that survives at this size.
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.28,
          height: size,
          backgroundColor: ink,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size * 0.28,
          backgroundColor: ink,
        }}
      />
    </View>
  );
}
