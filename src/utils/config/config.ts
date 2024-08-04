import { readFileSync, writeFileSync } from "fs"
import { get } from "radash"

export default class ConfigUtils {
  static config?: Config

  static initialize() {
    try {
      const configRaw = readFileSync("config.json", {
        encoding: "utf-8"
      })
      ConfigUtils.config = JSON.parse(configRaw)
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
}

export interface UserConfig {
  roles?: string[]
}

export interface Config {
  user?: {
    [userId: string]: UserConfig | undefined
  }
}
