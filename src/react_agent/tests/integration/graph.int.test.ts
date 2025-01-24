import { it } from "@jest/globals";
import { BaseMessage } from "@langchain/core/messages";

import { graph } from "../../graph.js";

it("Simple runthrough", async () => {
  const res = await graph.invoke({
    messages: [{ role: "user", content: "Test DeepSeek integration" }],
    configurable: {
      model: "deepseek/deepseek-chat", // Explicitly set if not default
    },
  });
  expect(
    res.messages.find((message: BaseMessage) => message._getType() === "tool"),
  ).toBeDefined();
});
