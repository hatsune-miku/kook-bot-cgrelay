import dotenv from "dotenv"
import { die } from "../server/die"

const result = dotenv.config({ path: ".env" })
const config = result.parsed ?? {}

export const Env: EnvType = {
  BotToken: config.BOT_TOKEN || die("环境配置错误：BOT_TOKEN"),
  OpenAIKeys: config.OPENAI_API_KEYS?.split(",") || [],
  ErnieAccessKey:
    config.ERNIE_ACCESS_KEY || die("环境配置错误：ERNIE_ACCESS_KEY"),
  ErnieSecretKey:
    config.ERNIE_SECRET_KEY || die("环境配置错误：ERNIE_SECRET_KEY")
}

export interface EnvType {
  BotToken: string
  OpenAIKeys: string[]
  ErnieAccessKey: string
  ErnieSecretKey: string
}
