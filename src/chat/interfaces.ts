import { RespondToUserParameters } from "../events"
import { ParseEventResultValid } from "./directives"

export interface IChatDirectivesManager {
  respondToUser(params: RespondToUserParameters): void
  respondCardMessageToUser(params: RespondToUserParameters): void
  dispatchDirectives(parsedEvent: ParseEventResultValid): boolean
}
