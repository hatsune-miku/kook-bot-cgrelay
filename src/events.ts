import { KEvent, KTextChannelExtra } from "./websocket/kwebsocket/types"

export const Events = {
    RespondToUser: 'respond-to-user'
}

export interface RespondToUserParameters {
    originalEvent: KEvent<KTextChannelExtra>
    content: string
}
