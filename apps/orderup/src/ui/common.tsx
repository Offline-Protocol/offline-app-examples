import { Button, cn, Icon, PersonAvatar, Text } from '@offline-app-examples/ui';
import { LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { MyStatus } from '../domain/orders';

// Full class names (not built from parts) so Tailwind can see them.
export const STATUS_STYLE: Record<
  MyStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  sending: {
    label: 'Sending…',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  new: { label: 'New', bg: 'bg-sky/15', text: 'text-[#1F64D6]', dot: 'bg-sky' },
  cooking: {
    label: 'Cooking',
    bg: 'bg-sunny/20',
    text: 'text-[#9A6200]',
    dot: 'bg-sunny',
  },
  ready: {
    label: 'Ready',
    bg: 'bg-teal/15',
    text: 'text-[#00786F]',
    dot: 'bg-teal',
  },
  served: {
    label: 'Served',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

export function StatusPill({ status }: { status: MyStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-3 py-1',
        s.bg,
      )}
    >
      <View className={cn('size-2 rounded-full', s.dot)} />
      <Text className={cn('text-xs font-bold', s.text)}>{s.label}</Text>
    </View>
  );
}

type Person = { id: string; name: string };

export function TopBar({
  eyebrow,
  title,
  people,
  onLeave,
}: {
  eyebrow: string;
  title: string;
  people: Person[];
  onLeave: () => void;
}) {
  return (
    <View className="border-border flex-row items-center gap-3 border-b px-5 pb-3 pt-2">
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          {eyebrow}
        </Text>
        <Text
          className="text-2xl font-extrabold tracking-tight"
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View
        className="flex-row"
        accessibilityLabel={people.map((p) => p.name).join(', ')}
      >
        {people.slice(0, 4).map((person, i) => (
          <PersonAvatar
            key={person.id}
            person={person}
            className={cn(
              'border-background size-10 border-2',
              i > 0 && '-ml-3',
            )}
          />
        ))}
      </View>
      <Button
        variant="outline"
        size="sm"
        onPress={onLeave}
        accessibilityLabel="Leave"
      >
        <Icon as={LogOut} size={16} />
        <Text>Leave</Text>
      </Button>
    </View>
  );
}

/** Re-renders every `ms` so "3 min ago" stays true. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export function timeAgo(since: number, now: number) {
  const min = Math.floor((now - since) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
}
