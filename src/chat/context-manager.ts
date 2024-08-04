import { ContextUnit } from "./types"

export class ContextManager {
  private guildIdToUserIdToContexts = new Map<
    string,
    Map<string, ContextUnit[]>
  >()

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

  getMixedContext(guildId: string): ContextUnit[] {
    if (!this.guildIdToUserIdToContexts.has(guildId)) {
      return []
    }
    const userIdToContexts = this.guildIdToUserIdToContexts.get(guildId)!
    const units: ContextUnit[] = []
    for (const context of userIdToContexts.values()) {
      for (const unit of context) {
        units.push(unit)
      }
    }
    units.sort((a, b) => a.timestamp - b.timestamp)
    if (units.length > 12) {
      return units.slice(units.length - 12)
    }
    return units
  }

  appendToContext(
    guildId: string,
    userId: string,
    displayName: string,
    role: ContextUnit["role"],
    content: ContextUnit["content"]
  ) {
    const context = this.getContext(guildId, userId)
    context.push({
      role: role,
      name: displayName,
      content: content,
      timestamp: Date.now()
    })

    console.log("Pushed", displayName, content)
    if (context.length > 12) {
      context.splice(context.length - 12)
    }
  }
}
