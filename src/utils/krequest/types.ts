/*
 * @Path          : \kook-bot-cgrelay\src\utils\krequest\types.ts
 * @Created At    : 2024-05-21 16:30:11
 * @Last Modified : 2024-05-27 14:07:58
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { KEventType } from "../../websocket/kwebsocket/types"

/**
 * 仅Bot内部使用的扩展类型，其中 `success` 等价于 `code === 0`
 */
export interface KResponseExt<ResultType> extends KResponse<ResultType> {
    success: boolean
}

export interface KResponse<ResultType> {
    code: number
    message: string
    data: ResultType
}

export interface KGatewayResult {
    url: string
}

export interface CreateChannelMessageProps {
    type: KEventType

    /**
     * 目标频道 id
     */
    target_id: string

    content: string

    /**
     * msgid
     */
    quote?: string

    /**
     * 服务器不做处理，原样返回
     */
    nonce?: string

    temp_target_id?: string
}

export interface EditChannelMessageProps {
    msg_id: string
    content: string
    quote?: string
    temp_target_id?: string
}

export interface CreateChannelMessageResult {
    msg_id: string
    msg_timestamp: number
    nonce: string
}

export interface WhoAmIResult {
    id: string
    username: string
    identify_num: string
    online: boolean
    os: string
    status: number  // 0/1: Normal, 10: Blocked
    avatar: string
    banner: string
    bot: boolean
    mobile_verified: boolean
    mobile_prefix: string
    mobile: string
    invited_count: number
}
