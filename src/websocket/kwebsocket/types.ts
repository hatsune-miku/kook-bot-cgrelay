/*
 * @Path          : \kook-bot-cgrelay\src\websocket\kwebsocket\types.ts
 * @Created At    : 2024-05-21 17:32:13
 * @Last Modified : 2024-05-27 11:48:04
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

export enum KWSState {
    OPENING_GATEWAY = "OPENING_GATEWAY",
    OPENING_GATEWAY_1ST_RETRY = "OPENING_GATEWAY_1ST_RETRY",
    OPENING_GATEWAY_LAST_RETRY = "OPENING_GATEWAY_LAST_RETRY",
    OPENING_GATEWAY_AFTER_DISCONNECT = "OPENING_GATEWAY_AFTER_DISCONNECT",
    WAITING_FOR_HANDSHAKE = "WAITING_FOR_HANDSHAKE",
    CONNECTED = "CONNECTED",
    WAITING_FOR_HEARTBEAT_RESPONSE = "WAITING_FOR_HEARTBEAT_RESPONSE",
    WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY = "WAITING_FOR_HEARTBEAT_RESPONSE_1ST_RETRY",
    WAITING_FOR_HEARTBEAT_RESPONSE_LAST_RETRY = "WAITING_FOR_HEARTBEAT_RESPONSE_LAST_RETRY",
    WAITING_FOR_RESUME_OK = "WAITING_FOR_RESUME_OK",
    IDLE = "IDLE",
}

export enum KMessageKind {
    Event = 0,
    HandshakeResult = 1,
    Ping = 2,
    Pong = 3,
    Resume = 4,
    Reconnect = 5,
    ResumeAck = 6,
}

/**
 * 信令
 * 
 * @param s 信令类型
 * @param d 数据字段mixed
 * @param sn 这个字段只在s=0的时候有，与webhook已知
 */
export interface KMessage<T> {
    s: KMessageKind
    d: T
    sn?: number
}

export interface OpenGatewayProps {
    compress: boolean

    /** 是否为断线重连 */
    fromDisconnect: boolean

    /** Ignored unless `fromDisconnect = true` */
    lastProcessedSn?: number

    /** Ignored unless `fromDisconnect = true` */
    lastSessionId?: string
}

export interface KHandshakeMessage {
    session_id: string
}

export interface KResumeAckMessage {
    session_id: string
}

export enum KEventType {
    Text = 1,
    Image = 2,
    Video = 3,
    File = 4,
    Audio = 8,
    KMarkdown = 9,
    Card = 10,
    System = 255,
}

export interface KEvent<KExtraType extends (KTextChannelExtra | KSystemEventExtra | unknown)> {
    channel_type: 'GROUP' | 'PERSON' | 'BROADCAST'
    type: KEventType

    /**
     * 发送目的。频道消息类时，代表的是 channel_id
     * 如果 channel_type 为 GROUP 且 type 为 System，则代表 guild_id
     */
    target_id: string

    /**
     * 发送者 id，1 代表系统
     */
    author_id: string

    /**
     * 消息内容。文件、图片、视频时，为 URL
     */
    content: string

    msg_id: string

    /**
     * 消息发送时间的毫秒时间戳
     */
    msg_timestamp: number

    /**
     * 与用户消息发送 api 中传的 nonce 一致
     */
    nonce: string

    extra: KExtraType
}

export interface KUser {
    id: string
    username: string
    nickname: string
    identify_num: string
    online: boolean
    bot: boolean

    /**
     * 状态，0/1代表正常，10代表封禁
     */
    status: number

    /**
     * 头像 URL
     */
    avatar: string

    /**
     * VIP 头像 URL，可能为 gif
     */
    vip_avatar: string

    mobile_verified: boolean
    roles: number[]
}

export interface KTextChannelExtra {
    type: KEventType
    guild_id: string
    channel_name: string
    mention: string[]
    mention_all: boolean
    mention_roles: number[]
    mention_here: boolean
    author: KUser
}

export interface KSystemEventExtra {
    type: string  // TODO: 是啥
    body: any  // TODO: 系统消息事件
}
