export interface ContextUnit {
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
