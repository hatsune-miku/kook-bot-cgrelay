/*
 * @Path          : \kook-bot-cgrelay\src\websocket\kwebsocket\kws-helper.ts
 * @Created At    : 2024-05-27 11:11:32
 * @Last Modified : 2024-05-28 16:56:02
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { KEvent, KEventType, KHandshakeMessage, KMessage, KMessageKind, KResumeAckMessage, KSystemEventExtra, KTextChannelExtra, KWSState } from "./types"
import { info, warn } from "../../utils/logging/logger"
import { Requests } from "../../utils/krequest/request"
import WebSocket from "ws"
import { decompressKMessage } from "../../utils/deflate/deflate"
import { KMessageQueue } from "../../utils/pqueue/kmqueue"

/**
 * KOOK WebSocket connection helper
 */
export class KWSHelper {
    private options: KWSOptions

    private pingSenderInterval: NodeJS.Timeout | null = null
    private clearQueueTimeout: NodeJS.Timeout | null = null
    private lastSn: number = 0
    private lastSessionId: string = ''
    private webSocket: WebSocket | null = null
    private gatewayUrl: string = ''
    private compression: boolean = true
    private state: KWSState = KWSState.IDLE
    private onSevereError: OnSevereError | null = null
    private onTextChannelEvent: OnTextChannelEvent | null = null
    private onSystemEvent: OnSystemEvent | null = null
    private onReset: OnReset | null = null

    private eventQueue: KMessageQueue<KEvent<unknown>> = new KMessageQueue()

    constructor(
        options: KWSHelperOptions = defaultKWSHelperOptions,
        websocketOptions: KWSOptions = defaultKWSOptions,
    ) {
        this.options = websocketOptions
        this.onSevereError = options.onSevereError
        this.onTextChannelEvent = options.onTextChannelEvent
        this.onSystemEvent = options.onSystemEvent
        this.onReset = options.onReset
    }

    /**
     * 更新状态，触发状态机
     */
    setState(state: KWSState, props?: {
        afterMillis?: number
    }): void {
        if (state === this.state) {
            warn('State is already', state)
            return
        }

        props ||= {}
        if (props.afterMillis) {
            setTimeout(() => {
                info('Switched state from', this.state, 'to', state)
                this.state = state
                this.handleStateUpdated()
            }, props.afterMillis)
        }
        else {
            info('Switched state from', this.state, 'to', state)
            this.state = state
            this.handleStateUpdated()
        }
    }

    tryRaiseSevereError(message: string) {
        this.onSevereError?.(message)
    }

    /**
     * 状态机函数
     */
    handleStateUpdated() {
        switch (this.state) {
            case KWSState.OPENING_GATEWAY:
                this.handleOpenGateway({ isRetry: false, isLastRetry: false })
                break

            case KWSState.OPENING_GATEWAY_AFTER_DISCONNECT:
                this.handleOpenGatewayInfiniteRetry(this.options.infiniteRetryDelayInitial)
                break

            case KWSState.OPENING_GATEWAY_1ST_RETRY:
                this.handleOpenGateway({ isRetry: true, isLastRetry: false })
                break

            case KWSState.OPENING_GATEWAY_LAST_RETRY:
                this.handleOpenGateway({ isRetry: true, isLastRetry: true })
                break

            case KWSState.WAITING_FOR_HANDSHAKE:
                this.handleWaitingForHandshake()
                break

            case KWSState.CONNECTED:
                this.handleConnected()
                break

            case KWSState.WAITING_FOR_HEARTBEAT_RESPONSE:
                this.handleWaitingForHeartbeatResponse()
                break

            case KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY:
                this.handleWaitingForPong1stRetry()
                break

            case KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_LAST_RETRY:
                this.handleWaitingForPongLastRetry()
                break

            case KWSState.WAITING_FOR_RESUME_OK:
                this.handleWaitingForResumeOk()
                break
        }
    }

    /**
     * 发送信令
     */
    sendKMessage<T>(message: KMessage<T>) {
        const serialized = JSON.stringify(message)
        this.webSocket?.send(serialized)
    }

    sendHeartbeatRequest() {
        this.sendKMessage({ s: KMessageKind.Ping, sn: this.lastSn, d: {} })
    }

    sendResumeRequest() {
        this.sendKMessage({ s: KMessageKind.Resume, sn: this.lastSn, d: {} })
    }

    sendResumeAck() {
        this.sendKMessage({ s: KMessageKind.ResumeAck, sn: this.lastSn, d: {} })
    }

    /**
     * 1. 获取Gateway
     * 
     * @param fromDisconnect 是否走断线重连逻辑？
     */
    async handleOpenGateway({ isRetry, isLastRetry }: { isRetry: boolean, isLastRetry: boolean }) {
        // 连接 Gateway
        const result = await Requests.openGateway({
            compress: this.compression,
            fromDisconnect: false,
        })

        // 如果成功，进入第三步（收hello包）
        if (result.success) {
            const gateway = result.data
            this.handleGatewayReady(gateway.url)
            this.setState(KWSState.WAITING_FOR_HANDSHAKE)
            return
        }

        // Gateway的最后一次重试失败了
        if (isLastRetry) {
            this.tryRaiseSevereError("无法连接到服务器")
            return
        }

        // 第一次重试失败了，4s后重试下一次
        if (isRetry) {
            this.setState(KWSState.OPENING_GATEWAY_LAST_RETRY, { afterMillis: this.options.finalOpenGatewayRetryDelay })
            return
        }

        // 首次失败，2s后重试
        this.setState(KWSState.OPENING_GATEWAY_1ST_RETRY, { afterMillis: this.options.firstOpenGatewayRetryDelay })
    }


    async handleOpenGatewayInfiniteRetry(duration: number) {
        info("Infinite reconnecting with duration=", duration)

        const tryReconnect = async () => {
            // 重连连接 Gateway
            const result = await Requests.openGateway({
                compress: this.compression,
                fromDisconnect: true,
                lastProcessedSn: this.lastSn,
                lastSessionId: this.lastSessionId,
            })
            if (!result.success) {
                // 重连失败，按照指数回退重试
                this.handleOpenGatewayInfiniteRetry(
                    Math.min(
                        duration * 2,
                        this.options.infiniteRetryDelayMaximum
                    )
                )
                return
            }

            // 终于连接成功了
            const gateway = result.data
            this.handleGatewayReady(gateway.url)
            this.setState(KWSState.WAITING_FOR_HANDSHAKE)
        }
        setTimeout(() => {
            tryReconnect()
        }, duration)
    }

    handleWaitingForHandshake() {
        // XX秒后，如果还~在等待握手状态，则认为超时了
        setTimeout(() => {
            if (this.state === KWSState.WAITING_FOR_HANDSHAKE) {
                this.setState(KWSState.OPENING_GATEWAY, { afterMillis: this.options.openGatewayDelay })
            }
        }, this.options.handshakeTimeout)
    }

    handleConnected() {
        if (this.pingSenderInterval) {
            return
        }

        // 在连接中，每隔30秒发一次心跳ping包包
        const intervalTask = () => {
            if (this.state === KWSState.CONNECTED) {
                this.setState(KWSState.WAITING_FOR_HEARTBEAT_RESPONSE)
                this.sendHeartbeatRequest()
            }
            else {
                // 状态发生了变化的话，这个interval也就不运行了
                if (this.pingSenderInterval) {
                    clearInterval(this.pingSenderInterval)
                    this.pingSenderInterval = null
                }
            }
        }
        this.pingSenderInterval = setInterval(intervalTask, this.options.heartBeatInterval)

        // 先发一个
        intervalTask()
    }

    handleWaitingForHeartbeatResponse() {
        // XX秒后，如果还~在等待Pong的状态，则认为超时了
        setTimeout(() => {
            if (this.state === KWSState.WAITING_FOR_HEARTBEAT_RESPONSE) {
                this.setState(KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY, { afterMillis: this.options.firstHeartbeatRetryDelay })
            }
        }, this.options.heartbeatTimeout)
    }

    handleWaitingForPong1stRetry() {
        // 先发两次心跳ping (2, 4)
        setTimeout(this.sendHeartbeatRequest.bind(this), this.options.firstRepingDelay)
        setTimeout(this.sendHeartbeatRequest.bind(this), this.options.finalRepingDelay)

        // 发过ping了，如果XX秒后，还~没收到Pong，则认为超时了，触发断线重连
        const timeout = this.options.firstRepingDelay + this.options.finalRepingDelay + this.options.pongTimeout
        setTimeout(() => {
            if (this.state === KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY) {
                // 如果不成功，回退到第2步，但尝试两次resume
                this.setState(KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_LAST_RETRY)
            }
        }, timeout)
    }

    handleWaitingForPongLastRetry() {
        // 尝试两次Resume (8, 16)
        setTimeout(this.sendResumeRequest.bind(this), this.options.firstResumeRequestDelay)
        setTimeout(this.sendResumeRequest.bind(this), this.options.secondResumeRequestDelay)
        this.setState(KWSState.WAITING_FOR_RESUME_OK, { afterMillis: this.options.resumeOkTimeout })
    }

    handleWaitingForResumeOk() {
        // 如果XX秒后，还~在等待ResumeOk的状态，则认为超时了
        setTimeout(() => {
            // 回到无限重试状态
            if (this.state === KWSState.WAITING_FOR_RESUME_OK) {
                this.setState(KWSState.OPENING_GATEWAY_AFTER_DISCONNECT)
            }
        }, this.options.resumeOkTimeout)
    }

    async handleReceivedTextChannelEvent(sn: number | undefined, messageEvent: KEvent<KTextChannelExtra>) {
        info("Received message:", messageEvent)
        this.onTextChannelEvent?.(messageEvent, sn)
    }

    handleReceivedSystemEvent(sn: number | undefined, event: KEvent<KSystemEventExtra>) {
        info("Received system event:", event)
        this.onSystemEvent?.(event, sn)
    }

    handleReceivedEvent(sn: number | undefined, event: KEvent<unknown>) {
        const executeEvent = (event: KEvent<unknown>) => {
            if (event.type === KEventType.System) {
                this.handleReceivedSystemEvent(sn, event as KEvent<KSystemEventExtra>)
            }
            else {
                this.handleReceivedTextChannelEvent(sn, event as KEvent<KTextChannelExtra>)
            }
        }

        if (!sn) {
            info("Processing event without sn...")
            executeEvent(event)
            return
        }

        // 跳号发生
        if (sn - this.lastSn > 1) {
            warn("Jumped serial number detected", "lastSn=", this.lastSn, "sn=", sn)

            this.eventQueue.enqueue(event, sn)
            if (!this.clearQueueTimeout) {
                info("Set up clear queue timeout")
                this.clearQueueTimeout = setTimeout(() => {
                    info("Time is up! Try emptying queue...")
                    if (!this.eventQueue.isEmpty()) {
                        this.handleClearMessageQueueAndSetLastSn()
                    }
                    this.clearQueueTimeout = null
                }, 6000)
            }
        }
        else {
            // 没有跳号，处理
            executeEvent(event)
            this.lastSn = sn

            // 只有没跳号的信令发来了，才有意义去检测严格递增
            if (!this.eventQueue.isEmpty()) {
                info("One missing SN has finally received.")
                if (this.eventQueue.isPriorityStrictAscending(this.lastSn)) {
                    info("Jumped SN resolved. Clearing queue and processing ", this.eventQueue.size(), "events...")
                    this.handleClearMessageQueueAndSetLastSn()
                }
            }
        }
    }

    handleReceivedHandshakeResult(sessionId: string) {
        info("Server handshake success", "sessionId=", sessionId)
        this.lastSessionId = sessionId

        if (this.state === KWSState.WAITING_FOR_HANDSHAKE) {
            this.setState(KWSState.CONNECTED)
        }
    }

    handleReceivedPing() {
        warn("意外的收到了来自服务器的ping包")
        warn("不慌，我们pong回去！")
        this.sendKMessage({ s: KMessageKind.Pong, d: {} })
    }

    handleReceivedPong() {
        info("Server ponged back")
        if (this.state === KWSState.WAITING_FOR_HEARTBEAT_RESPONSE
            || this.state === KWSState.WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY
        ) {
            // 如果是等待Pong的状态，那么就进入正常的连接状态
            this.setState(KWSState.CONNECTED)
        }
    }

    handleReceivedReconnect() {
        // 任何时候，收到reconnect包，应该将当前消息队列，sn等全部清空
        // 然后回到第一步，否则消息可能会错乱
        this.lastSn = 0
        this.lastSessionId = ''
        this.gatewayUrl = ''
        this.setState(KWSState.OPENING_GATEWAY)
        this.onReset?.()
    }

    handleReceivedResumeAck(sessionId: string) {
        info("Server acked resume")
        this.lastSessionId = sessionId
        if (this.state === KWSState.WAITING_FOR_RESUME_OK) {
            this.setState(KWSState.CONNECTED)
        }
    }

    dispatchKMessage({ s: messageKind, d: data, sn: serialNumber }: KMessage<unknown>) {
        switch (messageKind) {
            case KMessageKind.Event:
                this.handleReceivedEvent(serialNumber, data as KEvent<unknown>)
                break

            case KMessageKind.HandshakeResult:
                this.handleReceivedHandshakeResult((data as KHandshakeMessage).session_id)
                break

            case KMessageKind.Ping:
                this.handleReceivedPing()
                break

            case KMessageKind.Pong:
                this.handleReceivedPong()
                break

            case KMessageKind.Reconnect:
                this.handleReceivedReconnect()
                break

            case KMessageKind.ResumeAck:
                this.handleReceivedResumeAck((data as KResumeAckMessage).session_id)
                break

            case KMessageKind.Resume:
                // 啊？服务端来了个resume
                // 好！ack！
                this.sendResumeAck()
                break

        }
    }

    startWebsocket() {
        this.setState(KWSState.OPENING_GATEWAY)
    }

    handleGatewayReady(gatewayUrl: string) {
        info("Gateway URL ready", gatewayUrl)
        this.gatewayUrl = gatewayUrl

        const ws = new WebSocket(this.gatewayUrl)
        ws.onopen = this.onWebSocketOpen.bind(this)
        ws.onmessage = this.onWebSocketMessage.bind(this)
        ws.onclose = this.onWebSocketClose.bind(this)
        ws.onerror = this.onWebSocketError.bind(this)
        this.webSocket = ws
    }

    onWebSocketOpen(ev: WebSocket.Event) {
        info('onWebSocketOpen', ev)
    }

    onWebSocketClose(ev: WebSocket.CloseEvent) {
        info('onWebSocketClose', ev.reason)
    }

    onWebSocketError(ev: WebSocket.ErrorEvent) {
        info('onWebSocketError', ev)
    }

    onWebSocketMessage(ev: WebSocket.MessageEvent) {
        if (this.compression) {
            info("Incoming message: (compressed)", "Decompressing...")
        }
        else {
            info("Incoming message, parsing JSON...")
        }

        // 传来的信令对象，根据当时的compress参数，决定这会儿要不要解压
        const message: KMessage<unknown> = this.compression
            ? decompressKMessage(ev.data as Buffer)
            : JSON.parse(ev.data as string)

        info("Incoming message:", JSON.stringify(message))

        // 分派消息
        this.dispatchKMessage(message)
    }

    handleClearMessageQueueAndSetLastSn() {
        let maxSn = this.lastSn
        while (!this.eventQueue.isEmpty()) {
            const [event, priority] = this.eventQueue.dequeue()!
            maxSn = Math.max(maxSn, priority)
            this.handleReceivedEvent(undefined, event)
        }
        this.eventQueue.clear()
        this.lastSn = maxSn
    }
}

export interface OnSevereError {
    (message: string): void
}

export interface OnTextChannelEvent {
    (event: KEvent<KTextChannelExtra>, sn: number | undefined): void
}

export interface OnSystemEvent {
    (event: KEvent<KSystemEventExtra>, sn: number | undefined): void
}

export interface OnReset {
    (): void
}

/**
 * All times are in milliseconds
 */
export interface KWSOptions {
    handshakeTimeout: number
    pongTimeout: number
    resumeOkTimeout: number
    heartbeatTimeout: number

    heartBeatInterval: number

    firstRepingDelay: number
    finalRepingDelay: number
    firstResumeRequestDelay: number
    secondResumeRequestDelay: number
    infiniteRetryDelayInitial: number
    infiniteRetryDelayMaximum: number
    openGatewayDelay: number
    firstOpenGatewayRetryDelay: number
    finalOpenGatewayRetryDelay: number
    firstHeartbeatRetryDelay: number
}

export interface KWSHelperOptions {
    onSevereError: OnSevereError | null
    onTextChannelEvent: OnTextChannelEvent | null
    onSystemEvent: OnSystemEvent | null
    onReset: OnReset | null
}

export const defaultKWSOptions: KWSOptions = {
    handshakeTimeout: 6000,
    pongTimeout: 6000,
    resumeOkTimeout: 6000,
    heartbeatTimeout: 6000,
    heartBeatInterval: 30000,
    firstRepingDelay: 2000,
    finalRepingDelay: 4000,
    firstResumeRequestDelay: 8000,
    secondResumeRequestDelay: 16000,
    infiniteRetryDelayInitial: 1000,
    infiniteRetryDelayMaximum: 60000,
    firstOpenGatewayRetryDelay: 2000,
    finalOpenGatewayRetryDelay: 4000,
    openGatewayDelay: 2000,
    firstHeartbeatRetryDelay: 2000
}

export const defaultKWSHelperOptions: KWSHelperOptions = {
    onSevereError: null,
    onTextChannelEvent: null,
    onSystemEvent: null,
    onReset: null
}
