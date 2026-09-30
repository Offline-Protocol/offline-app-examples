import {
  Badge,
  Button,
  cn,
  hardShadow,
  Icon,
  INK,
  PersonAvatar,
  Text,
} from '@offline-app-examples/ui';
import { Minus, Plus } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LOW_STOCK,
  PRODUCTS,
  type ProductId,
  type Stock,
} from '../domain/stock';
import { ProductArt } from './illustrations';

type Person = { id: string; name: string };

type Props = {
  storeName: string;
  isHost: boolean;
  /** Everyone in the store, this device first. */
  people: Person[];
  /** Member only: the host is out of range. */
  reconnecting: boolean;
  stock: Stock;
  /** Bumped per product when a change from another device lands. */
  flashes: Partial<Record<ProductId, number>>;
  onAdjust: (id: ProductId, delta: number) => void;
  onLeave: () => void;
};

export function InventoryScreen(props: Props) {
  const {
    storeName,
    isHost,
    people,
    reconnecting,
    stock,
    flashes,
    onAdjust,
    onLeave,
  } = props;
  const others = people.length - 1;
  let status: string;
  if (reconnecting) status = 'Reconnecting…';
  else if (!isHost) status = 'Connected';
  else if (others === 0) status = 'Open · waiting for people nearby';
  else
    status = `Open · ${others} ${others === 1 ? 'person' : 'people'} connected`;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="border-foreground gap-3 border-b-2 px-5 pb-4 pt-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="flex-1 font-serif text-4xl leading-[44px]"
            numberOfLines={1}
          >
            {storeName}
          </Text>
          <Button variant="outline" size="sm" onPress={onLeave}>
            <Text>{isHost ? 'Close store' : 'Leave'}</Text>
          </Button>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-2">
            <View
              className={cn(
                'border-foreground size-3 border-2',
                reconnecting || others === 0 ? 'bg-sunny' : 'bg-teal',
              )}
            />
            <Text
              className="text-muted-foreground text-sm font-medium"
              numberOfLines={1}
            >
              {status}
            </Text>
          </View>
          <View className="flex-row pl-1.5">
            {people.map((person) => (
              <PersonAvatar
                key={person.id}
                person={person}
                className="-ml-1.5 size-10"
              />
            ))}
          </View>
        </View>
        {reconnecting ? (
          <View className="bg-sunny border-foreground flex-row items-center gap-3 rounded-md border-2 px-4 py-3">
            <ActivityIndicator color={INK} />
            <Text className="flex-1 text-sm font-medium">
              Reconnecting to store… Changes you make now are sent when it is
              back.
            </Text>
          </View>
        ) : null}
      </View>
      <ScrollView contentContainerClassName="flex-row flex-wrap justify-between gap-y-4 px-5 pb-6 pt-4">
        {PRODUCTS.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            qty={stock[product.id]}
            flash={flashes[product.id] ?? 0}
            onAdjust={(delta) => onAdjust(product.id, delta)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

type CardProps = {
  product: (typeof PRODUCTS)[number];
  qty: number;
  flash: number;
  onAdjust: (delta: number) => void;
};

function ProductCard({ product, qty, flash, onAdjust }: CardProps) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (flash === 0) return;
    glow.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(300, withTiming(0, { duration: 700 })),
    );
  }, [flash, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View
      className="bg-card border-foreground w-[48.3%] gap-3 rounded-lg border-2 p-4"
      style={hardShadow}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <View className="items-center">
        <ProductArt id={product.id} size={76} />
        <StockBadge qty={qty} />
      </View>
      <View>
        <Text className="text-base font-bold">{product.name}</Text>
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {product.unit}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <RoundButton
          icon={Minus}
          label={`Remove one ${product.name}`}
          disabled={qty === 0}
          onPress={() => onAdjust(-1)}
          className="bg-secondary"
          iconClassName="text-foreground"
        />
        <Text
          className="text-3xl font-bold"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {qty}
        </Text>
        <RoundButton
          icon={Plus}
          label={`Add one ${product.name}`}
          onPress={() => onAdjust(1)}
          className="bg-teal"
          iconClassName="text-foreground"
        />
      </View>
    </View>
  );
}

function StockBadge({ qty }: { qty: number }) {
  if (qty > LOW_STOCK) return null;
  const out = qty === 0;
  return (
    <Badge
      className={cn(
        'absolute right-0 top-0',
        out ? 'bg-destructive' : 'bg-sunny',
      )}
    >
      <Text className={out ? 'text-white' : 'text-foreground'}>
        {out ? 'Out' : 'Low'}
      </Text>
    </Badge>
  );
}

function RoundButton(props: {
  icon: typeof Plus;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  className: string;
  iconClassName: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={6}
      className={cn(
        'border-foreground size-10 items-center justify-center rounded-md border-2 active:opacity-70',
        props.className,
        props.disabled && 'opacity-40',
      )}
    >
      <Icon
        as={props.icon}
        size={18}
        strokeWidth={2.75}
        className={props.iconClassName}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The teal ring a card flashes when another device changes it.
  glow: {
    position: 'absolute',
    inset: -2,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#10C683',
    backgroundColor: 'rgba(16,198,131,0.18)',
  },
});
