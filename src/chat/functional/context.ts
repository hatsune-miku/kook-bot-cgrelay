import { KEvent, KTextChannelExtra } from "../../websocket/kwebsocket/types"
import { ContextManager } from "../context-manager"
import { ChatDirectivesManager } from "../directives"

export class ToolFunctionContext {
  constructor(
    public readonly event: KEvent<KTextChannelExtra>,
    public readonly directivesManager: ChatDirectivesManager,
    public readonly contextManager: ContextManager
  ) {}
}
