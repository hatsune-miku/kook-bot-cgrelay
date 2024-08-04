import { KEvent, KTextChannelExtra } from "./websocket/kwebsocket/types"

export const Events = {
  RespondToUser: "respond-to-user",
  RespondCardMessageToUser: "respond-card-message-to-user"
}

export interface RespondToUserParameters {
  originalEvent: KEvent<KTextChannelExtra>
  content: string
}

export interface KCardMessageSubTextElement {
  // TODO
  type: "kmarkdown"
  content: string
}

export interface KCardMessageContainedElement {
  // TODO
  type: "image"
  src?: string
}
export interface KCardMessageSubElement {
  // TODO
  type: "section" | "container"
  text?: KCardMessageSubTextElement
  elements?: KCardMessageContainedElement[]
}

export interface KCardMessageElement {
  // TODO
  type: "card" | "container"
  theme: "primary" | "secondary"
  size: "sm" | "md" | "lg"
  modules: KCardMessageSubElement[]
}

export type KCardMessage = KCardMessageElement[]
