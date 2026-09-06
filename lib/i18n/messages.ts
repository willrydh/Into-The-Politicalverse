import core from "./messages-core.json";
import ui from "./messages-ui.json";
import live from "./messages-live.json";
import context from "./messages-context.json";
import model from "./messages-model.json";
export type Locale = "sv" | "en";
export const messages = [...core, ...ui, ...live, ...context, ...model] as Array<[string, string]>;
