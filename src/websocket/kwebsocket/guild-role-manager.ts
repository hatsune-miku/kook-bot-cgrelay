import { Requests } from "../../utils/krequest/request"
import { info } from "../../utils/logging/logger"

/**
 * Bot在不同服务器有不同Role ID
 * 用户有时候会通过 @role 来 @Bot
 * 缓存这些信息，避免频繁请求
 */
export class GuildRoleManager {
  private guildIdToRoles = new Map<string, number[]>()

  async getMyRolesAt(guildId: string, userId: string): Promise<number[]> {
    if (this.guildIdToRoles.has(guildId)) {
      return this.guildIdToRoles.get(guildId)!
    }

    info("getMyRolesAt cache miss, querying...")
    const result = await Requests.queryUser({
      user_id: userId,
      guild_id: guildId
    })

    if (!result.success) {
      throw new Error(`Failed to query roles: ${result.message}`)
    }

    const roles = result.data.roles
    this.guildIdToRoles.set(guildId, roles)
    return roles
  }
}
