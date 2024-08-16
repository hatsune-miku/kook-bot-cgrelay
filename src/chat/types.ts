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

export enum ChatBotBackend {
  ChatGPT = "chatgpt",
  Ernie = "ernie"
}

export type GuildIdToUserIdToContexts = Map<string, Map<string, ContextUnit[]>>

export type GuildIdToUserIdToContextsData = {
  [guildId: string]: {
    [userId: string]: ContextUnit[]
  }
}
