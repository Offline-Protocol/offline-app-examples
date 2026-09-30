import {
  Button,
  hardShadow,
  Icon,
  PersonAvatar,
  Text,
} from '@offline-app-examples/ui';
import { ChevronLeft, CloudOff } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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

// Everyone gets their own color: sort the ids of the people in the doc and hand out colors
// in that order. Every phone sorts the same ids, so everyone agrees on who is which color.
// Unique for up to 5 people, more than a BLE room holds.
const COLORS = ['#FF5029', '#10C683', '#FFC929', '#4D79FF', '#9E66FF'];
// Shared by the input and its cursor mirror, so both wrap the text identically.
const TEXT_CLASS = 'p-0 font-sans text-[17px] leading-[26px]';

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
  const [scrollY, setScrollY] = useState(0);

  // A remote edit before our caret moved it: put the native caret back on the same spot.
  const { caretFix } = doc;
  useEffect(() => {
    if (caretFix && input.current?.isFocused())
      input.current.setSelection(caretFix.start, caretFix.end);
  }, [caretFix]);

  // Remote cursors are drawn on a mirror of the text behind the input: the same text in the
  // same font and width, invisible except for a tinted box on the character next to each
  // cursor. The input itself only ever holds plain text. (Styled <Text> children inside the
  // TextInput also work on iOS, but Android re-sets the whole styled text on every keystroke,
  // so the document flickers and the tinted run jumps lines.)
  const ids = [me.id, ...doc.others.map((o) => o.id)].sort();
  const personColor = (id: string) => COLORS[ids.indexOf(id) % COLORS.length]!;
  const others = doc.others.map((o) => ({ ...o, color: personColor(o.id) }));
  const segments = markCursors(doc.text, others);
  const people = others.length + 1;

  const leave = async () => {
    await doc.goodbye();
    onLeave();
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
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
          placeholderTextColor="#9A9284"
          maxLength={80}
          returnKeyType="done"
          className="text-foreground px-5 pb-1 pt-3 font-serif text-4xl"
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

        <View
          className="bg-card border-foreground mb-3 ml-3 mr-4 mt-1 flex-1 rounded-lg border-2 px-5 pb-3 pt-4"
          style={hardShadow}
        >
          {doc.text === '' ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center gap-2"
            >
              <EmptyDocIllustration />
              <Text className="text-muted-foreground text-sm font-medium">
                A blank page. Tap to start writing.
              </Text>
            </View>
          ) : null}
          <View className="flex-1 overflow-hidden">
            <RNText
              pointerEvents="none"
              className={`absolute inset-x-0 top-0 text-transparent ${TEXT_CLASS}`}
              style={{ transform: [{ translateY: -scrollY }] }}
            >
              {segments.map((s, i) => (
                <RNText
                  key={i}
                  style={
                    s.color ? { backgroundColor: `${s.color}66` } : undefined
                  }
                >
                  {s.text}
                </RNText>
              ))}
            </RNText>
            <TextInput
              ref={input}
              multiline
              value={doc.text}
              onChangeText={doc.onChangeText}
              onSelectionChange={(e) =>
                doc.onSelectionChange(e.nativeEvent.selection)
              }
              onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
              textAlignVertical="top"
              autoCapitalize="sentences"
              className={`text-foreground flex-1 ${TEXT_CLASS}`}
            />
          </View>
          <Text className="text-muted-foreground pt-2 text-right text-xs font-semibold uppercase tracking-wider">
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
      <View className="bg-sunny border-foreground ml-2 shrink flex-row items-center gap-1.5 rounded-md border-2 px-2.5 py-1">
        <Icon as={CloudOff} size={14} className="text-foreground" />
        <Text className="shrink text-xs font-bold" numberOfLines={1}>
          Offline - edits will sync when nearby
        </Text>
      </View>
    );
  }
  return (
    <View className="bg-teal border-foreground flex-row items-center gap-1.5 rounded-md border-2 px-2.5 py-1">
      <View className="bg-foreground size-2" />
      <Text className="text-xs font-bold uppercase tracking-wider">
        Synced, {people} {people === 1 ? 'person' : 'people'}
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
    <View className="bg-card border-foreground flex-row items-center gap-2 overflow-hidden rounded-md border-2 pr-3">
      <PersonAvatar
        person={person}
        color={color}
        className="size-8 rounded-none border-0 border-r-2"
      />
      <Text className="text-sm font-semibold" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
