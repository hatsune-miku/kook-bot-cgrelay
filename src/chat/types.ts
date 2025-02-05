export interface ContextUnit {
  id: string
  messageId: string
  role: "assistant" | "user"
  name: string
  content: string
  timestamp: number
  freeChat: boolean
}

export enum GroupChatStrategy {
  Off = "off",
  Legacy = "legacy",
  Normal = "normal"
}

export enum ChatBotBackend {
  GPT4o = "gpt-4o",
  GPT4Turbo = "gpt-4-turbo",
  GPT4 = "gpt-4",
  O1 = "o1",
  O1Mini = "o1-mini",
  O3Mini = "o3-mini",
  Ernie = "ernie",
  DeepSeekChat = "deepseek-chat",
  DeepSeekReasoner = "deepseek-reasoner"
}
