import { KEvent, KTextChannelExtra } from "./websocket/kwebsocket/types"

export const Events = {
  RespondToUser: "respond-to-user",
  RespondCardMessageToUser: "respond-card-message-to-user"
}

export interface RespondToUserParameters {
  originalEvent: KEvent<KTextChannelExtra>
  content: string
}

export type KCardSize = "sm" | "md" | "lg"

export interface KCardMessageSubTextElement {
  // TODO
  type: "kmarkdown" | "plain-text"
  content: string
}

export interface KCardMessageContainedElement {
  // TODO
  type: "image" | "file"
  title?: string
  src?: string
  size?: KCardSize | string
}
export interface KCardMessageSubElement {
  // TODO
  type: string
  text?: KCardMessageSubTextElement
  mode?: string
  accessory?: KCardMessageContainedElement
  elements?: KCardMessageContainedElement[]
  [key: string]: any
}

export interface KCardMessageElement {
  // TODO
  type: "card" | "container"
  theme: "primary" | "secondary" | "invisible"
  size: KCardSize
  color?: string
  modules: KCardMessageSubElement[]
}

export type KCardMessage = [KCardMessageElement]
