import { WebSocket } from "ws"
import { KWebSocketState } from "../websocket/types"

export interface SharedType {
    webSocket: WebSocket | null
    webSocketAddress: string
    webSocketCompressEnabled: boolean
    webSocketState: KWebSocketState
}

export const shared: SharedType = {
    webSocket: null,
    webSocketAddress: '',
    webSocketCompressEnabled: true,
    webSocketState: KWebSocketState.IDLE,
}
