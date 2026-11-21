import { useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** resting corner radius */
  radius?: number;
  /** radius while pressed – large enough to become a pill */
  pressedRadius?: number;
};

/**
 * GdzieAED button: softly rounded at rest, morphs into a pill while pressed
 * (the touch counterpart of the web buttons' hover animation).
 */
export function MorphPressable({ style, radius = 12, pressedRadius = 32, onPressIn, onPressOut, ...rest }: Props) {
  const [r] = useState(() => new Animated.Value(radius));
  const [pressed, setPressed] = useState(false);

  const animate = (to: number) =>
    Animated.timing(r, { toValue: to, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        animate(pressedRadius);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        animate(radius);
        onPressOut?.(e);
      }}
      style={[typeof style === 'function' ? style({ pressed }) : style, { borderRadius: r }]}
    />
  );
}
