/*
 * @Path          : \kook-bot-cgrelay\src\utils\krequest\types.ts
 * @Created At    : 2024-05-21 16:30:11
 * @Last Modified : 2024-05-28 16:38:36
 * @By            : Guan Zhen (guanzhen@chuanyuapp.com)
 * @Description   : Magic. Don't touch.
 */

import { KEventType } from "../../websocket/kwebsocket/types";

/**
 * 仅Bot内部使用的扩展类型，其中 `success` 等价于 `code === 0`
 */
export interface KResponseExt<ResultType> extends KResponse<ResultType> {
  success: boolean;
}

export interface KResponse<ResultType> {
  code: number;
  message: string;
  data: ResultType;
}

export interface KResponseHeader {
  rateLimit: KRateLimitHeader;
}

export interface KRateLimitHeader {
  /** 一段时间内，允许的最大请求次数 */
  requestsAllowed: number;

  /** 一段时间内，还剩下的请求次数 */
  requestsRemaining: number;

  /** 一个时间戳（秒），指示何时能恢复到最大次数 */
  timestampSecondsWhenFullyRecovered: number;

  /** 请求数的 bucket? */
  bucket: string;

  /** 是否已经触犯了全局请求次数限制 */
  didTriggeredGlobalRateLimit: boolean;
}

export interface KGatewayResult {
  url: string;
}

export interface CreateChannelMessageProps {
  type: KEventType;

  /**
   * 目标频道 id
   */
  target_id: string;

  content: string;

  /**
   * msgid
   */
  quote?: string;

  /**
   * 服务器不做处理，原样返回
   */
  nonce?: string;

  temp_target_id?: string;
}

export interface EditChannelMessageProps {
  msg_id: string;
  content: string;
  quote?: string;
  temp_target_id?: string;
}

export interface CreateChannelMessageResult {
  msg_id: string;
  msg_timestamp: number;
  nonce: string;
}

export interface WhoAmIExtendProps {
  user_id: string;
  guild_id: string;
}

export interface WhoAmIResult {
  id: string;
  username: string;
  identify_num: string;
  online: boolean;
  os: string;
  status: number; // 0/1: Normal, 10: Blocked
  avatar: string;
  banner: string;
  bot: boolean;
  mobile_verified: boolean;
  mobile_prefix: string;
  mobile: string;
  invited_count: number;
}

export interface WhoAmIExtendResult {
  id: string;
  username: string;
  nickname: string;
  identify_num: string;
  online: boolean;
  status: number;
  avatar: string;
  vip_avatar: string;
  is_vip: boolean;
  bot: boolean;
  mobile_verified: boolean;
  roles: number[];
  joined_at: number;
  active_time: number;
}
