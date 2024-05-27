import 'dotenv/config'
import { die } from '../server/die'

export const Env: EnvType = {
    BotToken: process.env.BOT_TOKEN || die('环境配置错误：BOT_TOKEN'),
    OpenAIKeys: process.env.OPENAI_API_KEYS?.split(',') || []
}

export interface EnvType {
    BotToken: string
    OpenAIKeys: string[]
}
