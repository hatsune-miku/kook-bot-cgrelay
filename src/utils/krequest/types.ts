/*
 * @Path          : \kook-bot-cgrelay\src\utils\krequest\types.ts
 * @Created At    : 2024-05-21 16:30:11
 * @Last Modified : 2024-05-22 16:45:10
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { KEventType } from "../../websocket/types"

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
