import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import * as Icons from '../../src/ui/Icon';

/**
 * Every icon, drawn big and small, through the real components.
 *
 * `react-native` is aliased to `react-native-web` at bundle time, so the
 * styles a phone would apply are the styles the browser applies — the
 * same border and transform rules, not a hand-drawn approximation of
 * them. Approximating is how the Ultimate icon was signed off twice
 * while looking nothing like the picture that had been checked.
 */
const NAMES = Object.keys(Icons).filter((k) => /Icon$/.test(k)).sort();

document.body.style.margin = '0';
document.body.style.background = '#fdf6ec';
const host = document.createElement('div');
document.body.appendChild(host);

createRoot(host).render(
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 900, padding: 12 }}>
    {NAMES.map((name) => {
      const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[name];
      return (
        <View key={name} style={{ width: 150, alignItems: 'center', paddingVertical: 10 }}>
          <Icon size={96} color="#1d1a2e" />
          <View style={{ height: 8 }} />
          <Icon size={22} color="#1d1a2e" />
          <Text style={{ fontSize: 11, color: '#1d1a2e', marginTop: 6 }}>{name}</Text>
        </View>
      );
    })}
  </View>,
);
(window as any).__ready = true;
