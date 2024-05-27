/*
 * @Path          : \kook-bot-cgrelay\src\utils\krequest\request.ts
 * @Created At    : 2024-05-21 16:22:37
 * @Last Modified : 2024-05-27 16:02:44
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { error } from "../logging/logger"
import { CreateChannelMessageProps, CreateChannelMessageResult, EditChannelMessageProps, KGatewayResult, KResponse, KResponseExt, WhoAmIExtendProps, WhoAmIExtendResult, WhoAmIResult } from "./types"
import { KEventType, OpenGatewayProps } from "../../websocket/kwebsocket/types"
import { Env } from "../env/env"

export const BASE_URL = 'https://www.kookapp.cn'
export const AUTHORIZATION = `Bot ${Env.BotToken}`

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export class Requests {
    static async request<T>(url: string, method: RequestMethod, data?: any): Promise<KResponseExt<T>> {
        const requestData: object = data ?? {}
        const headers: HeadersInit = {
            'Authorization': AUTHORIZATION,
            'Content-type': 'application/json',
        }
        const request: RequestInit = {
            headers: headers,
            method: method,
        }

        if (method === 'POST' || method === 'PUT') {
            request.body = JSON.stringify(requestData)
        }
        else {
            url += '?' + queryFromObject(requestData)
        }

        let responseText: string
        let responseObject: KResponse<T>

        try {
            const response = await fetch(BASE_URL + url, request)
            responseText = await response.text()

            if (response.status !== 200) {
                return failureFromCode(response.status)
            }
        }
        catch (e) {
            error(e)
            return fail(1145, "网络错误")
        }

        try {
            responseObject = JSON.parse(responseText)
        }
        catch {
            error('返回数据不是有效的JSON')
            return fail(1145, "返回数据不是有效的JSON")
        }

        return { success: true, ...responseObject }
    }

    /**
     * @param props compress: 是否压缩？fromDisconnect: 是否为断线重连？
     * @returns 
     */
    static async openGateway(props: OpenGatewayProps): Promise<KResponseExt<KGatewayResult>> {
        const queryParams: any = {
            compress: props.compress ? 1 : 0
        }

        if (props.fromDisconnect) {
            queryParams['resume'] = 1
            queryParams['sn'] = props.lastProcessedSn
            queryParams['session_id'] = props.lastSessionId
        }

        return this.request('/api/v3/gateway/index', 'GET', queryParams)
    }

    static async reactToMessage(messageId: string, emojiCode: string): Promise<KResponseExt<[]>> {
        return this.request(`/api/v3/message/add-reaction`, 'POST', {
            msg_id: messageId,
            emoji: emojiCode
        })
    }

    static async createChannelMessage(props: CreateChannelMessageProps): Promise<
        KResponseExt<CreateChannelMessageResult>
    > {
        return this.request(`/api/v3/message/create`, 'POST', props)
    }

    static async updateChannelMessage(props: EditChannelMessageProps): Promise<KResponseExt<{}>> {
        return this.request(`/api/v3/message/update`, 'POST', props)
    }

    static async queryWhoAmI(): Promise<KResponseExt<WhoAmIResult>> {
        return this.request(`/api/v3/user/me`, 'GET')
    }

    static async queryWhoAmIExtend(props: WhoAmIExtendProps): Promise<KResponseExt<WhoAmIExtendResult>> {
        return this.request(`/api/v3/user/view`, 'GET', props)
    }
}

/**
 * @example {a: 1, b: 2} => 'a=1&b=2'
 */
export function queryFromObject(obj: Record<string, any>): string {
    return Object.keys(obj)
        .map(key => `${key}=${obj[key]}`)
        .join('&')
}

function fail(code: number, message: string): KResponseExt<any> {
    return { success: false, message: message, code: code, data: {} }
}

function success<T>(message: string, data: T): KResponseExt<T> {
    return { success: true, message: message, code: 0, data: data }
}

function failureFromCode(statusCode: number): KResponseExt<any> {
    switch (statusCode) {
        case 401:
            return fail(401, "未授权")
        case 403:
            return fail(403, "禁止访问")
        case 404:
            return fail(404, "找不到资源")
        case 500:
            return fail(500, "服务器错误")
        default:
            return fail(1145, "未知错误")
    }
}
