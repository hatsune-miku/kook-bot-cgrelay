import dotenv from "dotenv"
import { die } from "../server/die"

const result = dotenv.config({ path: ".env" })
const config = result.parsed ?? {}

export const Env: EnvType = {
  BotToken: config.BOT_TOKEN || die("环境配置错误：BOT_TOKEN"),
  OpenAIKeys: config.OPENAI_API_KEYS?.split(",") || [],
  DeepSeekKeys: config.DEEPSEEK_API_KEYS?.split(",") || [],
  ErnieAccessKey:
    config.ERNIE_ACCESS_KEY || die("环境配置错误：ERNIE_ACCESS_KEY"),
  ErnieSecretKey:
    config.ERNIE_SECRET_KEY || die("环境配置错误：ERNIE_SECRET_KEY"),
  QWeatherPrivateKey:
    config.QWEATHER_PRIVATE_KEY.replace("\\n", "\n") ||
    die("环境配置错误：QWEATHER_PRIVATE_KEY"),
  QWeatherKeyId: config.QWEATHER_KID || die("环境配置错误：QWEATHER_KID"),
  QWeatherProjectId:
    config.QWEATHER_PID || die("环境配置错误：QWEATHER_PROJECT_ID")
}

export interface EnvType {
  BotToken: string
  OpenAIKeys: string[]
  DeepSeekKeys: string[]
  ErnieAccessKey: string
  ErnieSecretKey: string
  QWeatherPrivateKey: string
  QWeatherKeyId: string
  QWeatherProjectId: string
}
