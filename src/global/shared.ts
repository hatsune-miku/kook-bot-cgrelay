import { WhoAmIDefault } from "../mock/placeholders";
import { WhoAmIResult } from "../utils/krequest/types";

export interface SharedType {
  me: WhoAmIResult;
}

export const shared: SharedType = {
  me: WhoAmIDefault
};
