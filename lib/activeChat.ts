type ActiveChatContext = {
  loadId: string;
  otherUserId: string;
};

let activeChat: ActiveChatContext | null = null;

export function setActiveChatContext(ctx: ActiveChatContext): void {
  activeChat = ctx;
}

export function clearActiveChatContext(ctx?: Partial<ActiveChatContext>): void {
  if (!ctx) {
    activeChat = null;
    return;
  }
  if (
    activeChat &&
    (ctx.loadId == null || ctx.loadId === activeChat.loadId) &&
    (ctx.otherUserId == null || ctx.otherUserId === activeChat.otherUserId)
  ) {
    activeChat = null;
  }
}

export function getActiveChatContext(): ActiveChatContext | null {
  return activeChat;
}

