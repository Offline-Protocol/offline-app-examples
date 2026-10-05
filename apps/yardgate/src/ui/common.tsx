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
      <Button variant="outline" size="sm" onPress={onLeave} accessibilityLabel="Leave">
        <Icon as={LogOut} size={16} />
        <Text>Leave</Text>
      </Button>
    </View>
  );
}

export function DebugStrip({
  pending,
  decided,
  duplicateResponses,
  neighbors,
}: {
  pending: number;
  decided: number;
  duplicateResponses: number;
  neighbors: number;
}) {
  return (
    <View className="border-foreground bg-muted/40 border-t-2 px-4 py-2">
      <Text className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
        Presenter
      </Text>
      <Text className="text-foreground font-mono text-xs">
        pending: {pending} · decided: {decided} · idempotent replays: {duplicateResponses} · BLE
        neighbors: {neighbors}
      </Text>
    </View>
  );
}

export function useNow(ms = 15_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
