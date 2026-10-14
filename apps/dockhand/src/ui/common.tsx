import { Button, cn, Icon, PersonAvatar, Text } from '@offline-app-examples/ui';
import { BadgeCheck, CloudCheck, LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Handoff } from '../domain/handoff';

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
    <View className="border-foreground bg-background flex-row items-center gap-3 border-b-2 px-5 pb-3 pt-2">
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
          {eyebrow}
        </Text>
        <Text className="font-serif text-3xl leading-[38px]" numberOfLines={1}>
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
            className={cn('size-10', i > 0 && '-ml-2')}
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

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; name: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: o.id === value }}
            className={cn(
              'rounded-sm border-2 px-3 py-2',
              o.id === value
                ? 'border-foreground bg-sunny'
                : 'border-muted bg-muted/30',
            )}
          >
            <Text className="text-sm font-semibold">{o.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** One handoff: load, dock, who signed, whether this device has synced it. */
export function HandoffCard({
  handoff,
  synced,
  now,
  children,
}: {
  handoff: Handoff;
  synced: boolean;
  now: number;
  children?: React.ReactNode;
}) {
  const a = handoff.assignment;
  return (
    <View
      className={cn(
        'border-foreground rounded-md border-2 p-3',
        a ? 'bg-white' : 'bg-amber-100',
      )}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs font-bold uppercase">
            {handoff.vehicle.name} · {handoff.driverName || 'Driver'}
          </Text>
          <Text className="mt-1 text-base font-semibold">
            BOL {handoff.load.bol} · Trailer {handoff.load.trailer}
          </Text>
          <Text className="text-muted-foreground text-sm">
            Seal {handoff.load.seal || 'none'} · {handoff.load.pallets} pallets
          </Text>
        </View>
        {a ? (
          <View className="border-foreground bg-teal rounded-sm border-2 px-2 py-1">
            <Text className="font-serif text-xl">{a.dock}</Text>
          </View>
        ) : null}
      </View>
      {a ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Badge icon={BadgeCheck} text="Driver + yard signed" />
          {synced ? <Badge icon={CloudCheck} text="Synced" /> : null}
        </View>
      ) : null}
      {children}
      <Text className="text-muted-foreground mt-2 font-mono text-[10px]">
        {handoff.handoffId} · {timeAgo(handoff.checkedInAt, now)}
        {a ? ` · ${a.yardName}` : ''}
      </Text>
    </View>
  );
}

function Badge({ icon, text }: { icon: typeof BadgeCheck; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={icon} size={14} className="text-foreground" />
      <Text className="text-xs font-bold">{text}</Text>
    </View>
  );
}

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
