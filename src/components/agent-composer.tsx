import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "./market-ui";
import { tradingColors as colors, chatFonts, space } from "../theme";
import type { PendingAttachment } from "../agent/attachments";

/**
 * The message box: one rounded field with the text on top and, on the line
 * below, attach on the left and the microphone on the right. Once there is
 * something to send, the microphone becomes the send button; while
 * listening it stops the recording.
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
  const hasContent = draft.trim().length > 0 || attachments.length > 0;
  const action = listening ? "stop" : hasContent ? "send" : "mic";
  return (
    <View style={s.wrap}>
      <View style={s.field}>
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
        <View style={s.tools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach a photo or file"
            onPress={onAttach}
            hitSlop={6}
            style={({ pressed }) => [s.tool, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="plus" size={20} color={colors.ice} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action === "send" ? "Send message" : action === "stop" ? "Stop listening" : "Speak to the agent"}
            disabled={action === "send" ? busy : false}
            onPress={action === "send" ? onSend : onToggleVoice}
            hitSlop={6}
            style={({ pressed }) => [
              s.tool,
              action === "send" && s.send,
              action === "stop" && s.stop,
              { opacity: action === "send" && busy ? 0.4 : pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name={action} size={18} color={action === "send" ? colors.canvas : colors.ice} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: space.edge, paddingTop: 8, paddingBottom: 4 },
  field: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: 6,
    paddingBottom: 6,
  },
  chips: { gap: 8, paddingHorizontal: 10, paddingTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
    paddingLeft: 6,
    paddingRight: 10,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  thumb: { width: 24, height: 24, borderRadius: 6 },
  chipText: { flexShrink: 1, fontFamily: chatFonts.regular, fontSize: 13, color: colors.ice },
  input: {
    minHeight: 40,
    maxHeight: 132,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    color: colors.ice,
    fontFamily: chatFonts.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  tool: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  send: { backgroundColor: colors.ice },
  stop: { backgroundColor: colors.cobalt },
});
