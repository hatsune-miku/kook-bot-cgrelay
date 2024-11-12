import { KUser } from "../../websocket/kwebsocket/types"
import { ParseEventResultValid } from "../directives"

export interface YukiContext {
  guildId: string
  channelId: string
  author: KUser
  event: ParseEventResultValid
}
