import EmojiPicker from "emoji-picker-react";

export default function ChitChatEmojiPicker({
  onEmojiClick,
  width = 340,
  height = 380,
}) {
  return (
    <div className="cc-emoji-picker">
      <EmojiPicker
        onEmojiClick={onEmojiClick}
        width={width}
        height={height}
        lazyLoadEmojis
        previewConfig={{
          showPreview: false,
        }}
      />
    </div>
  );
}
