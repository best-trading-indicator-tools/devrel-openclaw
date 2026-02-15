import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import { createXApiTools } from "./src/x-api-tool.js";

export default function register(api: OpenClawPluginApi) {
  const tools = createXApiTools();
  for (const tool of tools) {
    api.registerTool(tool);
  }
}
