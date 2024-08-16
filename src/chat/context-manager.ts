import ConfigUtils from "../utils/config/config"
import { ContextUnit, GuildIdToUserIdToContexts } from "./types"

export class ContextManager {
  private guildIdToUserIdToContexts: GuildIdToUserIdToContexts = new Map<
    string,
    Map<string, ContextUnit[]>
  >()

  constructor() {
    this.guildIdToUserIdToContexts = ConfigUtils.getGuildIdToUserIdToContexts()
  }

  getContext(guildId: string, userId: string): ContextUnit[] {
    if (!this.guildIdToUserIdToContexts.has(guildId)) {
      this.guildIdToUserIdToContexts.set(guildId, new Map())
    }

    const userIdToContexts = this.guildIdToUserIdToContexts.get(guildId)!
    if (!userIdToContexts.has(userId)) {
      userIdToContexts.set(userId, [])
    }

    return userIdToContexts.get(userId)!
  }

  getMixedContext(guildId: string, includesFreeChat: boolean): ContextUnit[] {
    console.log("Getting mixed context", this.guildIdToUserIdToContexts)
    if (!this.guildIdToUserIdToContexts.has(guildId)) {
      return []
    }
    const userIdToContexts = this.guildIdToUserIdToContexts.get(guildId)!
    const units: ContextUnit[] = []
    for (const context of userIdToContexts.values()) {
      for (const unit of context) {
        if (!unit.freeChat || includesFreeChat) {
          units.push(unit)
        }
      }
    }
    units.sort((a, b) => a.timestamp - b.timestamp)
    const limit = includesFreeChat ? 24 : 12
    if (units.length > limit) {
      return units.slice(units.length - limit)
    }
    return units
  }

  appendToContext(
    guildId: string,
    userId: string,
    displayName: string,
    role: ContextUnit["role"],
    content: ContextUnit["content"],
    freeChat: ContextUnit["freeChat"]
  ) {
    const context = this.getContext(guildId, userId)
    context.push({
      role: role,
      name: displayName,
      content: content,
      timestamp: Date.now(),
      freeChat: freeChat
    })

    console.log("Pushed", displayName, content)
    if (context.length > 64) {
      context.splice(64)
    }

    ConfigUtils.setGuildIdToUserIdToContexts(this.guildIdToUserIdToContexts)
  }

  setContext(guildId: string, userId: string, context: ContextUnit[]) {
    this.guildIdToUserIdToContexts.get(guildId)?.clear()
    this.guildIdToUserIdToContexts.get(guildId)?.set(userId, context)
    ConfigUtils.setGuildIdToUserIdToContexts(this.guildIdToUserIdToContexts)
  }
}
