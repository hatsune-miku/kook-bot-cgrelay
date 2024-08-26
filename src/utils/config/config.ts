import { readFileSync, writeFileSync } from "fs"
import { get } from "radash"
import {
  ContextUnit,
  GuildIdToUserIdToContexts,
  GuildIdToUserIdToContextsData
} from "../../chat/types"

export const MessageLengthUpperBound = Math.round(4000 * 0.9)

export const WhitelistedGuildIds: Record<string, string> = {
  "3266153385602000": "小分队",
  "9705615544844948": "water",
  "3340148861735314": "HL",
  "4499354561413658": "saa",
  "8624952735398189": "a1knla",
  "7760397450327014": "sand"
}

export default class ConfigUtils {
  static config?: Config

  static initialize() {
    try {
      const configRaw = readFileSync("config.json", {
        encoding: "utf-8"
      })
      ConfigUtils.config = JSON.parse(configRaw)
      console.log("Loaded user config.", ConfigUtils.config)
    } catch (e) {
      ConfigUtils.config = {}
    }
  }

  static persist() {
    try {
      writeFileSync("config.json", JSON.stringify(ConfigUtils.config, null, 2))
    } catch (e) {
      console.error("Failed to persist config:", e)
    }
  }

  static getUserConfig(userId: string): UserConfig {
    return get(ConfigUtils.config, `user['${userId}]`) ?? {}
  }

  static setUserConfig(userId: string, userConfig: UserConfig) {
    ConfigUtils.config = {
      ...ConfigUtils.config,
      user: {
        ...ConfigUtils.config?.user,
        [userId]: userConfig
      }
    }
    ConfigUtils.persist()
  }

  static getGuildIdToUserIdToContexts(): GuildIdToUserIdToContexts {
    const data = ConfigUtils.config?.guildIdToUserIdToContexts ?? {}
    const guildIdToUserIdToContexts = new Map<
      string,
      Map<string, ContextUnit[]>
    >()
    const guildIds = Object.keys(data)

    for (const guildId of guildIds) {
      const userIdToContexts = data[guildId]
      const userIdToContext = new Map<string, ContextUnit[]>()
      const userIds = Object.keys(userIdToContexts)

      for (const userId of userIds) {
        userIdToContext.set(userId, userIdToContexts[userId])
      }

      guildIdToUserIdToContexts.set(guildId, userIdToContext)
    }
    return guildIdToUserIdToContexts
  }

  static setGuildIdToUserIdToContexts(
    guildIdToUserIdToContexts: GuildIdToUserIdToContexts
  ) {
    const data: GuildIdToUserIdToContextsData = {}
    const guildIds = guildIdToUserIdToContexts.keys()
    for (const guildId of guildIds) {
      data[guildId] = {}

      const userIdToContext = guildIdToUserIdToContexts.get(guildId)!
      const userIds = userIdToContext.keys()

      for (const userId of userIds) {
        data[guildId][userId] = userIdToContext.get(userId)!
      }
    }
    ConfigUtils.config ??= {}
    ConfigUtils.config.guildIdToUserIdToContexts = data
    ConfigUtils.persist()
  }

  static getWhitelistedGuildReferenceName(guildId: string): string | undefined {
    return WhitelistedGuildIds[guildId]
  }
}

export interface UserConfig {
  roles?: string[]
}

export interface Config {
  user?: {
    [userId: string]: UserConfig | undefined
  }
  guildIdToUserIdToContexts?: GuildIdToUserIdToContextsData
}
