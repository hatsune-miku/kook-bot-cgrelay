export interface ContextUnit {
  id: string
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
  GPT4o2024 = "gpt-4o-2024-05-13",
  GPT4Turbo = "gpt-4-turbo",
  GPT4Turbo2024 = "gpt-4-turbo-2024-04-09",
  GPT4 = "gpt-4",
  Ernie = "ernie"
}
