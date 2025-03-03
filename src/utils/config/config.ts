import { readFileSync, writeFileSync } from "fs"
import { get } from "radash"
import {
  ChatBotBackend,
  ContextUnit,
  GroupChatStrategy
} from "../../chat/types"
import { info } from "../logging/logger"

export const MessageLengthUpperBound = Math.round(4000 * 0.9)

/**
 * 写的也太乱了！！！！！
 */
export default class ConfigUtils {
  static config?: GlobalScopeConfig

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
      info("Config persisted.")
    } catch (e) {
      console.error("Failed to persist config:", e)
    }
  }

  static getGlobalConfig(): GlobalScopeConfig {
    ConfigUtils.config ??= {}
    return ConfigUtils.config
  }

  static getGuildConfig(guildId: string): GuildScopeConfig {
    const config = ConfigUtils.getGlobalConfig()
    config.guilds ??= {}
    config.guilds[guildId] ??= {}
    return config.guilds[guildId] ?? {}
  }

  static getChannelConfig(
    guildId: string,
    channelId: string
  ): ChannelScopeConfig {
    const guildConfig = ConfigUtils.getGuildConfig(guildId)
    guildConfig.channels ??= {}
    guildConfig.channels[channelId] ??= {}
    return guildConfig.channels[channelId] ?? {}
  }

  static updateGlobalConfig(
    updater: (config: GlobalScopeConfig) => GlobalScopeConfig
  ) {
    ConfigUtils.config = updater(ConfigUtils.getGlobalConfig())
  }

  static updateGuildConfig(
    guildId: string,
    updater: (config: GuildScopeConfig) => GuildScopeConfig
  ) {
    ConfigUtils.updateGlobalConfig((config) => ({
      ...config,
      guilds: {
        ...config.guilds,
        [guildId]: updater(config.guilds?.[guildId] ?? {})
      }
    }))
  }

  static updateChannelConfig(
    guildId: string,
    channelId: string,
    updater: (config: ChannelScopeConfig) => ChannelScopeConfig
  ) {
    ConfigUtils.updateGuildConfig(guildId, (guildConfig) => ({
      ...guildConfig,
      channels: {
        ...guildConfig.channels,
        [channelId]: updater(guildConfig.channels?.[channelId] ?? {})
      }
    }))
  }
}

export interface UserConfig {
  roles?: string[]
}

export interface GuildScopeConfig {
  users?: {
    [userId: string]: UserConfig | undefined
  }
  channels?: {
    [channelId: string]: ChannelScopeConfig | undefined
  }
  userDefinedScripts?: Record<string, string>
}

export interface ChannelScopeConfig {
  backend?: ChatBotBackend
  userIdToContextUnits?: Record<string, ContextUnit[]>
  groupChatStrategy?: GroupChatStrategy
  allowOmittingMentioningMe?: boolean
}

export interface GlobalScopeConfig {
  guilds?: {
    [guildId: string]: GuildScopeConfig | undefined
  }
  whiteListedGuildIds?: Record<string, string>
}
