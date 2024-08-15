import "dotenv/config"
import { die } from "../server/die"

export const Env: EnvType = {
  BotToken: process.env.BOT_TOKEN || die("环境配置错误：BOT_TOKEN"),
  OpenAIKeys: process.env.OPENAI_API_KEYS?.split(",") || [],
  ErnieAccessKey:
    process.env.ERNIE_ACCESS_KEY || die("环境配置错误：ERNIE_ACCESS_KEY"),
  ErnieSecretKey:
    process.env.ERNIE_SECRET_KEY || die("环境配置错误：ERNIE_SECRET_KEY")
}

export interface EnvType {
  BotToken: string
  OpenAIKeys: string[]
  ErnieAccessKey: string
  ErnieSecretKey: string
}
