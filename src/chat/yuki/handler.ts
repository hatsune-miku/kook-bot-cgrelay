import { ParseEventResultValid } from "../directives"
import { IChatDirectivesManager } from "../interfaces"
import { YukiContext } from "./context"
import YukiCommandSession from "./session"
import { parseDirectiveInvocation } from "./utils"

export default function yukiSubCommandHandler(
  manager: IChatDirectivesManager,
  event: ParseEventResultValid
) {
  const invocation = parseDirectiveInvocation(event.parameter)
  if (!invocation) {
    return
  }

  const context: YukiContext = {
    guildId: event.originalEvent.extra.guild_id,
    channelId: event.originalEvent.target_id,
    author: event.userProperties.metadata,
    event: event
  }

  const session = new YukiCommandSession(manager, invocation, context)
  session.interpretInvocation()
}
