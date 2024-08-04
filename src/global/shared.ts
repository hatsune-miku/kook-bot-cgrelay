import { QuerySelfDefault } from "../mock/placeholders"
import { QuerySelfResult } from "../utils/krequest/types"

export interface SharedType {
  me: QuerySelfResult
}

export const shared: SharedType = {
  me: QuerySelfDefault
}
