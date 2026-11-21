// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  qrcode: 'qr-code',
  'doc.text.fill': 'description',
  'square.grid.2x2.fill': 'apps',
  'heart.fill': 'favorite',
  'bolt.heart.fill': 'monitor-heart',
  'phone.fill': 'phone',
  'location.fill': 'my-location',
  'figure.walk': 'directions-walk',
  'arrow.clockwise': 'refresh',
  xmark: 'close',
  'exclamationmark.triangle.fill': 'warning',
  'car.fill': 'directions-car',
  'building.columns.fill': 'account-balance',
  clock: 'schedule',
  lock: 'lock',
  key: 'vpn-key',
  'person.2': 'group',
  'book.fill': 'menu-book',
} satisfies IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color as ComponentProps<typeof MaterialIcons>['color']} size={size} name={MAPPING[name]} style={style} />;
}
