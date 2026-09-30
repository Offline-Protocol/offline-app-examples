import { Button, Icon, PersonAvatar, Text } from '@offline-app-examples/ui';
import { ChevronLeft, CloudOff } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markCursors, wordCount } from '../domain/text';
import { useSharedDoc } from '../useSharedDoc';
import { EmptyDocIllustration } from './illustrations';

// Same palette and hash as PersonAvatar, so a cursor is the color of its owner's avatar.
const COLORS = ['#FF385C', '#00A699', '#FFAA00', '#428BFF', '#8A5CD6'];
const ON_COLOR = '#FFFFFF';
function personColor(id: string) {
  let hash = 0;
  // eslint-disable-next-line no-bitwise
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

type Props = {
  space: string;
  me: { id: string; name: string };
  /** `data_changed` counts per document id, from the room's onProtocolEvent. */
  changes: Record<string, number>;
  /** At least one other phone is connected right now. */
  online: boolean;
  onLeave: () => void;
};

export function EditorScreen({ space, me, changes, online, onLeave }: Props) {
  const doc = useSharedDoc(space, me, changes);
  const input = useRef<TextInput>(null);

  // A remote edit before our caret moved it: put the native caret back on the same spot.
  const { caretFix } = doc;
  useEffect(() => {
    if (caretFix && input.current?.isFocused())
      input.current.setSelection(caretFix.start, caretFix.end);
  }, [caretFix]);

  // Remote cursors are drawn inside the text itself: the character next to each cursor
  // gets a tinted background. TextInput renders nested <Text> children as styled runs on
  // both iOS and Android, and the characters stay exactly the document's (nothing is
  // inserted), so typing, selection and offsets are untouched. An overlay would need the
  // position of every glyph, which TextInput does not report.
  const others = doc.others.map((o) => ({ ...o, color: personColor(o.id) }));
  const segments = markCursors(doc.text, others);
  const people = others.length + 1;

  const leave = async () => {
    await doc.goodbye();
    onLeave();
  };

  return (
    <SafeAreaView className="bg-secondary flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-3 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onPress={leave}
            accessibilityLabel="Leave document"
          >
            <Icon as={ChevronLeft} size={18} className="text-foreground" />
            <Text>Leave</Text>
          </Button>
          <SyncPill online={online} people={people} />
        </View>

        <TextInput
          value={doc.title}
          onChangeText={doc.onTitleChange}
          placeholder="Untitled document"
          placeholderTextColor="#B0B0B0"
          maxLength={80}
          returnKeyType="done"
          className="text-foreground px-5 pb-1 pt-3 text-3xl font-extrabold tracking-tight"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-14 grow-0"
          contentContainerClassName="items-center gap-2 px-5 py-2"
        >
          <PersonChip
            person={me}
            color={personColor(me.id)}
            label={`${me.name} (you)`}
          />
          {others.map((o) => (
            <PersonChip key={o.id} person={o} color={o.color} label={o.name} />
          ))}
        </ScrollView>

        <View className="bg-card border-border mx-3 mb-2 mt-1 flex-1 rounded-3xl border px-5 pb-3 pt-4 shadow-md shadow-black/5">
          {doc.text === '' ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center gap-2"
            >
              <EmptyDocIllustration />
              <Text className="text-muted-foreground text-sm">
                A blank page. Tap to start writing.
              </Text>
            </View>
          ) : null}
          <TextInput
            ref={input}
            multiline
            onChangeText={doc.onChangeText}
            onSelectionChange={(e) =>
              doc.onSelectionChange(e.nativeEvent.selection)
            }
            textAlignVertical="top"
            autoCapitalize="sentences"
            className="text-foreground flex-1 text-[17px] leading-[26px]"
          >
            {segments.map((s, i) =>
              s.color ? (
                <RNText
                  key={i}
                  style={{ backgroundColor: s.color, color: ON_COLOR }}
                >
                  {s.text}
                </RNText>
              ) : (
                <RNText key={i}>{s.text}</RNText>
              ),
            )}
          </TextInput>
          <Text className="text-muted-foreground pt-2 text-right text-xs">
            {wordCount(doc.text)} {wordCount(doc.text) === 1 ? 'word' : 'words'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SyncPill({ online, people }: { online: boolean; people: number }) {
  if (!online) {
    return (
      <View className="bg-sunny/15 ml-2 shrink flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
        <Icon as={CloudOff} size={14} className="text-foreground" />
        <Text className="shrink text-xs font-semibold" numberOfLines={1}>
          Offline — edits will sync when nearby
        </Text>
      </View>
    );
  }
  return (
    <View className="bg-teal/10 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
      <View className="bg-teal size-2 rounded-full" />
      <Text className="text-teal text-xs font-semibold">
        Synced · {people} {people === 1 ? 'person' : 'people'}
      </Text>
    </View>
  );
}

function PersonChip({
  person,
  color,
  label,
}: {
  person: { id: string; name: string };
  color: string;
  label: string;
}) {
  return (
    <View
      className="bg-card flex-row items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3"
      style={{ borderColor: `${color}55` }}
    >
      <PersonAvatar person={person} className="size-7" />
      <Text className="text-sm font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
