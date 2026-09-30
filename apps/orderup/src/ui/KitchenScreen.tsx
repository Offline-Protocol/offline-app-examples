import { Button, cn, Text } from '@offline-app-examples/ui';
import React, { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { menuItem } from '../domain/menu';
import type { KitchenState, Order, Status } from '../domain/orders';
import { STATUS_STYLE, timeAgo, TopBar, useNow } from './common';
import { BellArt, FoodArt } from './illustrations';

const COLUMNS: Status[] = ['new', 'cooking', 'ready'];

const ACTION: Record<Status, { label: string; className: string }> = {
  new: { label: 'Start cooking', className: 'bg-sunny active:bg-sunny/90' },
  cooking: { label: 'Mark ready', className: 'bg-teal active:bg-teal/90' },
  ready: { label: 'Clear', className: 'bg-foreground active:bg-foreground/90' },
};

type Props = {
  name: string;
  kitchen: KitchenState;
  waiters: { id: string; name: string }[];
  onAdvance: (id: string, from: Status) => void;
  onLeave: () => void;
};

/** The host: every open ticket, grouped by status. Tablets get three columns. */
export function KitchenScreen({
  name,
  kitchen,
  waiters,
  onAdvance,
  onLeave,
}: Props) {
  const now = useNow();
  const wide = useWindowDimensions().width >= 700;
  const [filter, setFilter] = useState<Status>('new');
  const byStatus = (s: Status) => kitchen.orders.filter((o) => o.status === s);
  const waiting =
    waiters.length === 0
      ? 'Waiting for waiters to join…'
      : `${waiters.length} waiter${waiters.length === 1 ? '' : 's'} connected`;

  const column = (status: Status) => (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-10">
      {byStatus(status).map((order) => (
        <Ticket key={order.id} order={order} now={now} onAdvance={onAdvance} />
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView className="bg-secondary flex-1" edges={['top', 'bottom']}>
      <View className="bg-background">
        <TopBar
          eyebrow={waiting}
          title={name}
          people={waiters}
          onLeave={onLeave}
        />
      </View>

      {kitchen.orders.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <BellArt size={140} />
          <Text className="text-xl font-bold">No orders yet</Text>
          <Text className="text-muted-foreground text-center">
            Tickets appear here the moment a waiter sends them.
          </Text>
        </View>
      ) : wide ? (
        <View className="flex-1 flex-row">
          {COLUMNS.map((status) => (
            <View key={status} className="border-border flex-1 border-r">
              <ColumnHeader status={status} count={byStatus(status).length} />
              {column(status)}
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-1">
          <View className="flex-row gap-2 px-4 pt-4">
            {COLUMNS.map((status) => (
              <Pressable
                key={status}
                onPress={() => setFilter(status)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === status }}
                className={cn(
                  'flex-1 rounded-2xl',
                  filter === status
                    ? 'bg-background shadow-sm shadow-black/10'
                    : 'active:bg-background/60',
                )}
              >
                <ColumnHeader status={status} count={byStatus(status).length} />
              </Pressable>
            ))}
          </View>
          {column(filter)}
        </View>
      )}
    </SafeAreaView>
  );
}

function ColumnHeader({ status, count }: { status: Status; count: number }) {
  const s = STATUS_STYLE[status];
  return (
    <View className="flex-row items-center justify-center gap-2 px-4 py-3">
      <View className={cn('size-2.5 rounded-full', s.dot)} />
      <Text className="font-bold">{s.label}</Text>
      <View className={cn('min-w-6 items-center rounded-full px-2', s.bg)}>
        <Text className={cn('text-xs font-bold leading-5', s.text)}>
          {count}
        </Text>
      </View>
    </View>
  );
}

function Ticket({
  order,
  now,
  onAdvance,
}: {
  order: Order;
  now: number;
  onAdvance: Props['onAdvance'];
}) {
  const s = STATUS_STYLE[order.status];
  const action = ACTION[order.status];
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      layout={LinearTransition}
    >
      <View className="bg-card border-border overflow-hidden rounded-3xl border shadow-sm shadow-black/5">
        <View
          className={cn(
            'flex-row items-center justify-between px-4 py-3',
            s.bg,
          )}
        >
          <Text className="text-xl font-extrabold">Table {order.table}</Text>
          <Text className={cn('text-sm font-semibold', s.text)}>
            {timeAgo(order.placedAt, now)}
          </Text>
        </View>
        <View className="gap-2 px-4 pt-3">
          {order.items.map((line) => (
            <View key={line.itemId} className="flex-row items-center gap-3">
              <FoodArt itemId={line.itemId} size={40} />
              <Text className="w-8 text-lg font-extrabold">{line.qty}×</Text>
              <Text className="flex-1 text-base font-medium">
                {menuItem(line.itemId)?.name ?? line.itemId}
              </Text>
            </View>
          ))}
          {order.note ? (
            <View className="bg-sunny/10 rounded-xl px-3 py-2">
              <Text className="text-sm italic">“{order.note}”</Text>
            </View>
          ) : null}
          <Text className="text-muted-foreground text-xs">
            From {order.waiter}
          </Text>
        </View>
        <Button
          className={cn('m-4', action.className)}
          onPress={() => onAdvance(order.id, order.status)}
        >
          <Text className="text-white">{action.label}</Text>
        </Button>
      </View>
    </Animated.View>
  );
}
