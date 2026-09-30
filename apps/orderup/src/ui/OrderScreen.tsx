import {
  Button,
  cn,
  hardShadow,
  Icon,
  Input,
  Text,
} from '@offline-app-examples/ui';
import { Minus, Plus, WifiOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MENU, menuItem, TABLES } from '../domain/menu';
import {
  NOTE_MAX,
  statusOf,
  type NewOrder,
  type WaiterState,
} from '../domain/orders';
import { StatusPill, timeAgo, TopBar, useNow } from './common';
import { FoodArt } from './illustrations';

type Props = {
  kitchenName: string;
  peers: { id: string; name: string }[]; // just the kitchen, while it is in range
  waiter: WaiterState;
  onSend: (order: Pick<NewOrder, 'table' | 'items' | 'note'>) => void;
  onLeave: () => void;
};

type Cart = Record<string, number>; // itemId -> qty

/** A waiter's device: pick a table, fill the cart, send it, watch its status. */
export function OrderScreen({
  kitchenName,
  peers,
  waiter,
  onSend,
  onLeave,
}: Props) {
  const connected = peers.length > 0;
  const wide = useWindowDimensions().width >= 700;
  const [table, setTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [note, setNote] = useState('');

  const change = (itemId: string, by: number) =>
    setCart((c) => ({
      ...c,
      [itemId]: Math.max(0, Math.min(20, (c[itemId] ?? 0) + by)),
    }));
  const items = MENU.filter((m) => cart[m.id]).map((m) => ({
    itemId: m.id,
    qty: cart[m.id]!,
  }));

  const send = () => {
    if (!table || items.length === 0) return;
    onSend({ table, items, note: note.trim() || undefined });
    setCart({});
    setNote('');
  };

  const menu = (
    <>
      <TablePicker table={table} onPick={setTable} />
      <Text className="px-5 pb-1 pt-6 font-serif text-2xl">Menu</Text>
      <View className="flex-row flex-wrap px-3.5">
        {MENU.map((item) => (
          <View key={item.id} className={cn('p-1.5', wide ? 'w-1/4' : 'w-1/2')}>
            <MenuCard
              itemId={item.id}
              qty={cart[item.id] ?? 0}
              onChange={change}
            />
          </View>
        ))}
      </View>
    </>
  );
  const side = (
    <>
      <CartPanel
        table={table}
        items={items}
        note={note}
        onNote={setNote}
        onSend={send}
      />
      <MyOrders waiter={waiter} />
    </>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <TopBar
        eyebrow="Connected to"
        title={kitchenName}
        people={peers}
        onLeave={onLeave}
      />
      {connected ? null : (
        <View className="bg-sunny border-foreground flex-row items-center gap-2 border-b-2 px-5 py-2">
          <Icon as={WifiOff} size={16} className="text-foreground" />
          <Text className="shrink text-sm font-semibold">
            Reconnecting to kitchen… orders will send when it is back.
          </Text>
        </View>
      )}
      {wide ? (
        <View className="flex-1 flex-row">
          <ScrollView className="flex-1" contentContainerClassName="pb-10">
            {menu}
          </ScrollView>
          <ScrollView
            className="bg-secondary border-foreground w-96 flex-none border-l-2"
            contentContainerClassName="pb-10"
          >
            {side}
          </ScrollView>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          {menu}
          {side}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TablePicker({
  table,
  onPick,
}: {
  table: number | null;
  onPick: (t: number) => void;
}) {
  return (
    <View className="gap-3 px-5 pt-4">
      <Text className="font-serif text-2xl">Table</Text>
      <View className="flex-row flex-wrap gap-2">
        {Array.from({ length: TABLES }, (_, i) => i + 1).map((t) => (
          <Pressable
            key={t}
            onPress={() => onPick(t)}
            accessibilityRole="radio"
            accessibilityState={{ selected: table === t }}
            accessibilityLabel={`Table ${t}`}
            className={cn(
              'border-foreground size-12 items-center justify-center rounded-md border-2',
              table === t ? 'bg-primary' : 'bg-card active:bg-accent',
            )}
          >
            <Text className="text-base font-bold">{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MenuCard({
  itemId,
  qty,
  onChange,
}: {
  itemId: string;
  qty: number;
  onChange: (itemId: string, by: number) => void;
}) {
  const item = menuItem(itemId)!;
  return (
    <Pressable
      onPress={() => onChange(itemId, 1)}
      accessibilityLabel={`Add ${item.name}`}
      className={cn(
        'border-foreground items-center gap-1 rounded-lg border-2 p-3 active:opacity-80',
        qty > 0 ? 'bg-accent' : 'bg-card',
      )}
      style={hardShadow}
    >
      <FoodArt itemId={itemId} size={84} />
      <Text className="text-base font-bold">{item.name}</Text>
      <View className="h-9 flex-row items-center gap-3">
        {qty > 0 ? (
          <>
            <Stepper
              icon={Minus}
              label={`Remove one ${item.name}`}
              onPress={() => onChange(itemId, -1)}
            />
            <Text className="min-w-5 text-center text-base font-bold">
              {qty}
            </Text>
            <Stepper
              icon={Plus}
              label={`Add one ${item.name}`}
              onPress={() => onChange(itemId, 1)}
            />
          </>
        ) : (
          <Text className="text-muted-foreground font-semibold">
            ${item.price}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function Stepper({
  icon,
  label,
  onPress,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      className="bg-foreground size-8 items-center justify-center rounded-md active:opacity-80"
    >
      <Icon as={icon} size={16} className="text-background" />
    </Pressable>
  );
}

function CartPanel({
  table,
  items,
  note,
  onNote,
  onSend,
}: {
  table: number | null;
  items: { itemId: string; qty: number }[];
  note: string;
  onNote: (note: string) => void;
  onSend: () => void;
}) {
  const total = items.reduce(
    (sum, l) => sum + l.qty * (menuItem(l.itemId)?.price ?? 0),
    0,
  );
  const hint = !table
    ? 'Pick a table first'
    : items.length === 0
      ? 'Tap dishes to add them'
      : null;
  return (
    <View className="gap-3 px-5 pt-6">
      <Text className="font-serif text-2xl">
        {table ? `Order for table ${table}` : 'New order'}
      </Text>
      {items.map((l) => (
        <View key={l.itemId} className="flex-row items-center gap-3">
          <FoodArt itemId={l.itemId} size={32} />
          <Text className="flex-1">
            <Text className="font-bold">{l.qty}× </Text>
            {menuItem(l.itemId)?.name}
          </Text>
          <Text className="text-muted-foreground">
            ${l.qty * (menuItem(l.itemId)?.price ?? 0)}
          </Text>
        </View>
      ))}
      <Input
        value={note}
        onChangeText={onNote}
        placeholder="Note for the kitchen (optional)"
        maxLength={NOTE_MAX}
      />
      <Button size="lg" disabled={hint !== null} onPress={onSend}>
        <Text>{hint ?? `Send to kitchen ($${total})`}</Text>
      </Button>
    </View>
  );
}

function MyOrders({ waiter }: { waiter: WaiterState }) {
  const now = useNow();
  if (waiter.mine.length === 0) return null;
  return (
    <View className="gap-3 px-5 pt-8">
      <Text className="font-serif text-2xl">My orders</Text>
      {waiter.mine.slice(0, 12).map((order) => {
        const status = statusOf(waiter, order.id);
        return (
          <Animated.View
            key={order.id}
            entering={FadeInDown}
            className={cn(
              'bg-card border-foreground flex-row items-center gap-3 rounded-md border-2 p-3',
              status === 'served' && 'opacity-60',
            )}
            // Ready orders pop up off the page.
            style={status === 'ready' ? hardShadow : undefined}
          >
            <View className="flex-1 gap-0.5">
              <Text className="font-bold">
                Table {order.table}
                <Text className="text-muted-foreground text-sm font-normal">
                  {'  '}
                  {timeAgo(order.placedAt, now)}
                </Text>
              </Text>
              <Text className="text-muted-foreground text-sm" numberOfLines={1}>
                {order.items
                  .map((l) => `${l.qty}× ${menuItem(l.itemId)?.name}`)
                  .join(', ')}
              </Text>
            </View>
            <StatusPill status={status} />
          </Animated.View>
        );
      })}
    </View>
  );
}
