import { Button, Text } from '@offline-app-examples/ui';
import { Check, Send } from 'lucide-react-native';
import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import {
  SECTORS,
  type FieldRecord,
  type FieldState,
  type Sector,
} from '../domain/ops';
import { DebugStrip, timeAgo, TopBar, useNow } from './common';

type Person = { id: string; name: string };

export function FieldScreen({
  postName,
  me,
  field,
  people,
  reconnecting,
  onStatus,
  onHandoff,
  onAccept,
  onLeave,
}: {
  postName: string;
  me: Person;
  field: FieldState;
  people: Person[];
  reconnecting: boolean;
  onStatus: (sector: Sector, text: string) => void;
  onHandoff: (sector: Sector, note: string) => void;
  onAccept: (operationId: string) => void;
  onLeave: () => void;
}) {
  const now = useNow();
  const [sector, setSector] = useState<Sector>(SECTORS[0]);
  const [text, setText] = useState('Sector cleared — all clear');
  const [handoffNote, setHandoffNote] = useState('You are lead for this block');

  const pendingForMe = field.records.filter(
    (r) =>
      r.kind === 'handoff' &&
      r.state === 'pending' &&
      r.authorId !== me.id,
  );

  return (
    <View className="bg-background flex-1">
      <TopBar
        eyebrow={reconnecting ? 'Reconnecting…' : 'Field unit'}
        title={postName}
        people={people}
        onLeave={onLeave}
      />
      <View className="gap-2 px-5 py-3">
        <Text className="text-muted-foreground text-xs font-bold uppercase">
          Sector
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SECTORS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSector(s)}
              className={`rounded-sm border-2 px-3 py-1 ${
                sector === s
                  ? 'border-foreground bg-sky'
                  : 'border-muted bg-muted/30'
              }`}
            >
              <Text className="text-sm font-semibold">{s}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          className="border-foreground rounded-sm border-2 px-3 py-2 text-base"
          value={text}
          onChangeText={setText}
          placeholder="Status update"
        />
        <Button onPress={() => onStatus(sector, text.trim())}>
          <Send size={18} color="#fff" />
          <Text>Post status</Text>
        </Button>
        <TextInput
          className="border-foreground rounded-sm border-2 px-3 py-2 text-base"
          value={handoffNote}
          onChangeText={setHandoffNote}
          placeholder="Handoff note"
        />
        <Button variant="outline" onPress={() => onHandoff(sector, handoffNote.trim())}>
          <Text>Hand off responsibility</Text>
        </Button>
      </View>
      {pendingForMe.length > 0 && (
        <View className="border-foreground mx-5 mb-2 rounded-md border-2 bg-amber-100 p-3">
          <Text className="font-bold">Accept handoff?</Text>
          {pendingForMe.map((h) => (
            <View key={h.operationId} className="mt-2 flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm">
                {h.kind === 'handoff' ? h.note : ''}
              </Text>
              <Button size="sm" onPress={() => onAccept(h.operationId)}>
                <Check size={16} color="#fff" />
                <Text>Accept</Text>
              </Button>
            </View>
          ))}
        </View>
      )}
      <FlatList
        data={[...field.records].reverse()}
        keyExtractor={(item) => item.operationId}
        contentContainerClassName="px-5 pb-24 gap-3"
        renderItem={({ item }) => (
          <FieldRecordCard record={item} now={now} meId={me.id} />
        )}
      />
      <DebugStrip
        pending={field.pending.length}
        synced={field.syncedIds.length}
        duplicatesDropped={field.hqDuplicatesDropped}
        hqTotal={field.syncedIds.length}
      />
    </View>
  );
}

function FieldRecordCard({
  record,
  now,
  meId,
}: {
  record: FieldRecord;
  now: number;
  meId: string;
}) {
  const line =
    record.kind === 'status'
      ? record.text
      : `${record.note} (${record.state})`;
  const mine = record.authorId === meId;
  return (
    <View
      className={`border-foreground rounded-md border-2 p-3 ${mine ? 'bg-sky/30' : 'bg-white'}`}
    >
      <Text className="text-muted-foreground text-xs font-bold uppercase">
        {record.sector}
      </Text>
      <Text className="text-foreground mt-1">{line}</Text>
      <Text className="text-muted-foreground mt-2 font-mono text-[10px]">
        {timeAgo(record.createdAt, now)}
      </Text>
    </View>
  );
}
