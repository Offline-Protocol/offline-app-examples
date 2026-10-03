import { Button, cn, Icon, PersonAvatar, Text } from '@offline-app-examples/ui';
import { LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

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

export function DebugStrip({
  pending,
  synced,
  duplicatesDropped,
  hqTotal,
}: {
  pending: number;
  synced: number;
  duplicatesDropped: number;
  hqTotal: number;
}) {
  return (
    <View className="border-foreground bg-muted/40 border-t-2 px-4 py-2">
      <Text className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
        Presenter
      </Text>
      <Text className="text-foreground font-mono text-xs">
        pending mesh: {pending} · synced HQ: {synced} · HQ records: {hqTotal} ·
        dupes dropped: {duplicatesDropped}
      </Text>
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
