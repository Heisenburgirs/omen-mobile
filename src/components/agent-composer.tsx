import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "./market-ui";
import { tradingColors as colors, chatFonts, space } from "../theme";
import type { PendingAttachment } from "../agent/attachments";

/**
 * The message box: attach on the left, and inside the field a button that
 * is the microphone while there is nothing to send and the send arrow once
 * there is. While listening it stops the recording.
 */
export function AgentComposer({
  draft,
  onChangeDraft,
  onSend,
  busy,
  attachments,
  onRemoveAttachment,
  onAttach,
  listening,
  onToggleVoice,
}: {
  draft: string;
  onChangeDraft: (text: string) => void;
  onSend: () => void;
  busy: boolean;
  attachments: PendingAttachment[];
  onRemoveAttachment: (index: number) => void;
  onAttach: () => void;
  listening: boolean;
  onToggleVoice: () => void;
}) {
  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !busy;
  const action = listening ? "stop" : canSend ? "send" : "mic";
  return (
    <View style={s.wrap}>
      {attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {attachments.map((a, i) => (
            <View key={`${a.name}-${i}`} style={s.chip}>
              {a.kind === "image" && a.uri ? (
                <Image source={{ uri: a.uri }} style={s.thumb} />
              ) : (
                <Icon name="file" size={16} color={colors.muted} />
              )}
              <Text numberOfLines={1} style={s.chipText}>
                {a.name}
              </Text>
              <Pressable accessibilityLabel={`Remove ${a.name}`} hitSlop={8} onPress={() => onRemoveAttachment(i)}>
                <Icon name="close" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach a photo or file"
          onPress={onAttach}
          style={({ pressed }) => [s.plus, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="plus" size={20} color={colors.ice} />
        </Pressable>
        <View style={s.field}>
          <TextInput
            accessibilityLabel="Message the agent"
            autoComplete="off"
            importantForAutofill="no"
            placeholder={listening ? "Listening…" : "Message your agent"}
            placeholderTextColor={colors.muted}
            selectionColor={colors.focus}
            cursorColor={colors.focus}
            value={draft}
            onChangeText={onChangeDraft}
            multiline
            maxLength={2000}
            style={s.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action === "send" ? "Send message" : action === "stop" ? "Stop listening" : "Speak to the agent"}
            disabled={action === "send" ? !canSend : busy && !listening}
            onPress={action === "send" ? onSend : onToggleVoice}
            style={({ pressed }) => [
              s.inner,
              action === "send" && s.send,
              action === "stop" && s.stop,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon
              name={action}
              size={18}
              color={action === "send" ? colors.canvas : action === "stop" ? colors.ice : colors.ice}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: space.edge, paddingTop: 8, paddingBottom: 4, gap: 8 },
  chips: { gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
    paddingLeft: 6,
    paddingRight: 10,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: { width: 24, height: 24, borderRadius: 6 },
  chipText: { flexShrink: 1, fontFamily: chatFonts.regular, fontSize: 13, color: colors.ice },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 3,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    flex: 1,
    maxHeight: 132,
    paddingTop: 9,
    paddingBottom: 9,
    color: colors.ice,
    fontFamily: chatFonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  inner: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  send: { backgroundColor: colors.ice },
  stop: { backgroundColor: colors.cobalt },
});
