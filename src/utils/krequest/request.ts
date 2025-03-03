/*
 * @Path          : \kook-bot-cgrelay\src\utils\krequest\request.ts
 * @Created At    : 2024-05-21 16:22:37
 * @Last Modified : 2024-05-29 18:15:42
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { error, info } from "../logging/logger"
import {
  CreateChannelMessageProps,
  CreateChannelMessageResult,
  EditChannelMessageProps,
  KGatewayResult,
  KRateLimitHeader,
  KResponse,
  KResponseExt,
  QuerySelfResult,
  KResponseHeader,
  QuerySelfExtendProps as QueryUserProps,
  WhoAmIExtendResult as QueryUserResult
} from "./types"
import { OpenGatewayProps } from "../../websocket/kwebsocket/types"
import { Env } from "../env/env"
import { DateTime } from "luxon"
import { die } from "../server/die"
import { MessageLengthUpperBound } from "../config/config"
import { sleep } from "radash"
import { createReadStream, openAsBlob } from "fs"
import { lookup } from "mime-types"
import { readFile } from "fs/promises"

export const BASE_URL = "https://www.kookapp.cn"
export const AUTHORIZATION = `Bot ${Env.BotToken}`

export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE"

const bucketToSpeedLimitIndication = new Map<string, KRateLimitHeader | null>()

/** 指示一个时间戳（毫秒），所有请求在此之前都不应该再发给 KOOK */
let disabledUntil: number = 0

export class Requests {
  static async request<T>(
    url: string,
    method: RequestMethod,
    data?: any,
    isFormData: boolean = false,
    returnRaw: boolean = false
  ): Promise<KResponseExt<T>> {
    const bucket = url.replace(`/api/v3/`, "")

    if (disabledUntil > DateTime.now().toMillis()) {
      return fail(1147, `All requests blocked until ${disabledUntil}`)
    }

    const indication = bucketToSpeedLimitIndication.get(bucket)

    if (indication) {
      if (indication.requestsRemaining < 10 && Math.random() < 0.5) {
        return fail(1148, `Too many requests for bucket ${bucket}`)
      }
    }

    const requestData: any = data ?? {}
    const headers: HeadersInit = {
      Authorization: AUTHORIZATION
    }
    if (!isFormData) {
      headers["Content-type"] = "application/json"
    }

    const request: RequestInit = {
      headers: headers,
      method: method
    }

    if (method === "POST" || method === "PUT" || method === "DELETE") {
      if (method === "POST" && isFormData) {
        request.body = requestData
      } else {
        request.body = JSON.stringify(requestData)
      }
    } else {
      url += "?" + queryFromObject(requestData)
    }

    let responseText: string
    let responseHeader: KResponseHeader | undefined
    let responseObject: KResponse<T>

    try {
      const response = await fetch(BASE_URL + url, request)
      responseText = await response.text()

      if (returnRaw) {
        return responseText as any
      }

      responseHeader = extractKResponseHeader(response.headers)

      if (response.status !== 200) {
        return failureFromCode(response.status)
      }
    } catch (e) {
      error(e)
      return fail(1145, "网络错误")
    }

    if (responseHeader) {
      const actualBucket = responseHeader.rateLimit.bucket
      if (
        actualBucket !== bucket &&
        !actualBucket.includes(bucket) &&
        !bucket.includes(actualBucket)
      ) {
        die(`Bucket not match (expected=${bucket}, actual=${actualBucket}).`)
      }

      if (responseHeader.rateLimit.didTriggeredGlobalRateLimit) {
        disabledUntil =
          responseHeader.rateLimit.timestampSecondsWhenFullyRecovered * 1000
        return fail(1146, "Speed rate hard limit reached.")
      }
      bucketToSpeedLimitIndication.set(bucket, responseHeader.rateLimit)
    }

    try {
      responseObject = JSON.parse(responseText)
    } catch {
      error("返回数据不是有效的JSON")
      return fail(1145, "返回数据不是有效的JSON")
    }

    return { success: true, ...responseObject }
  }

  /**
   * @param props compress: 是否压缩？fromDisconnect: 是否为断线重连？
   * @returns
   */
  static async openGateway(
    props: OpenGatewayProps
  ): Promise<KResponseExt<KGatewayResult>> {
    const queryParams: any = {
      compress: props.compress ? 1 : 0
    }

    if (props.fromDisconnect) {
      queryParams["resume"] = 1
      queryParams["sn"] = props.lastProcessedSn
      queryParams["session_id"] = props.lastSessionId
    }

    return Requests.request("/api/v3/gateway/index", "GET", queryParams)
  }

  static async reactToMessage(
    messageId: string,
    emojiCode: string
  ): Promise<KResponseExt<[]>> {
    return this.request(`/api/v3/message/add-reaction`, "POST", {
      msg_id: messageId,
      emoji: emojiCode
    })
  }

  static async createChannelMessageChunk(
    props: CreateChannelMessageProps
  ): Promise<KResponseExt<CreateChannelMessageResult>> {
    const chunks = Math.ceil(props.content.length / MessageLengthUpperBound)
    let ret: KResponseExt<CreateChannelMessageResult> | null = null
    let shouldPrependMarkdownMark = false

    for (let i = 0; i < chunks; ++i) {
      let chunk = props.content.slice(
        i * MessageLengthUpperBound,
        (i + 1) * MessageLengthUpperBound
      )

      if (shouldPrependMarkdownMark) {
        chunk = "\n```\n" + chunk
        shouldPrependMarkdownMark = false
      }

      // 有奇数个 ``` 标记
      const markdownMarkCount = (chunk.match(/```/g) ?? []).length
      if (markdownMarkCount % 2 !== 0) {
        chunk += "\n```\n"
        shouldPrependMarkdownMark = true
      }

      ret = await this.request(`/api/v3/message/create`, "POST", {
        ...props,
        content: `(${i + 1}/${chunks}) ${chunk}`
      })
      await sleep(100)
    }
    return ret!
  }

  static async createChannelMessage(
    props: CreateChannelMessageProps
  ): Promise<KResponseExt<CreateChannelMessageResult>> {
    if (props.content.length > MessageLengthUpperBound) {
      return this.createChannelMessageChunk(props)
    }
    return this.request(`/api/v3/message/create`, "POST", props)
  }

  static async updateChannelMessage(
    props: EditChannelMessageProps
  ): Promise<KResponseExt<{}>> {
    if (props.content.length > MessageLengthUpperBound) {
      return this.createChannelMessageChunk({
        type: props.extra.type,
        target_id: props.extra.target_id,
        ...props
      })
    }
    return this.request(`/api/v3/message/update`, "POST", props)
  }

  static async uploadFile(path: string): Promise<string> {
    const fileData = new Blob([await readFile(path)], {
      type: lookup(path) || undefined
    })
    const requestData = new FormData()
    requestData.append("file", fileData, path)

    const result = (await this.request(
      `/api/v3/asset/create`,
      "POST",
      requestData,
      true,
      true
    )) as any as string
    info(`Upload file result: ${result}`, requestData, fileData)
    const resultParsed = JSON.parse(result)
    return resultParsed.data?.url || ""
  }

  static async querySelfUser(): Promise<KResponseExt<QuerySelfResult>> {
    return this.request(`/api/v3/user/me`, "GET")
  }

  static async queryUser(
    props: QueryUserProps
  ): Promise<KResponseExt<QueryUserResult>> {
    return this.request(`/api/v3/user/view`, "GET", props)
  }
}

/**
 * @example {a: 1, b: 2} => 'a=1&b=2'
 */
export function queryFromObject(obj: Record<string, any>): string {
  return Object.keys(obj)
    .map((key) => `${key}=${obj[key]}`)
    .join("&")
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

function extractKResponseHeader(headers: Headers): KResponseHeader | undefined {
  const requestsAllowed = headers.get("X-Rate-Limit-Limit")
  const requestsRemaining = headers.get("X-Rate-Limit-Remaining")
  const timestampSecondsWhenFullyRecovered = headers.get("X-Rate-Limit-Reset")
  const bucket = headers.get("X-Rate-Limit-Bucket")
  const didTriggeredGlobalRateLimit = headers.get("X-Rate-Limit-Global")

  if (
    !requestsAllowed ||
    !requestsRemaining ||
    !timestampSecondsWhenFullyRecovered ||
    !bucket
  ) {
    return undefined
  }

  return {
    rateLimit: {
      requestsAllowed: Number.parseInt(requestsAllowed),
      requestsRemaining: Number.parseInt(requestsRemaining),
      timestampSecondsWhenFullyRecovered: Number.parseInt(
        timestampSecondsWhenFullyRecovered
      ),
      bucket: bucket,
      didTriggeredGlobalRateLimit: !!didTriggeredGlobalRateLimit
    }
  }
}
