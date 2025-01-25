// import { z } from "zod";
// import { ANALYZE_SENTENCE_PROMPT } from "../prompts.js";
// import { AnalysisOutput } from "../types.js";
// import { loadChatModel } from "../utils.js";
// import { Command } from "@langchain/langgraph";
// import { AgentStateSchema } from "../graph.js";

// const analysisSchema = z.object({
//   query: z
//     .string()
//     .nullable()
//     .describe("The verification query or null if no verification needed"),
//   reasoning: z
//     .string()
//     .describe("Explanation why this needs verification or not"),
//   needs_verification: z
//     .boolean()
//     .describe("Whether this sentence needs to be verified"),
// });

// export async function analyzeSentence(
//   state: typeof AgentStateSchema.State,
// ): Promise<Command> {
//   if (!state.articleSentence) {
//     return new Command({
//       goto: "fetch_nextsentence",
//     });
//   }

//   const sentence = state.articleSentence;
//   const filledPrompt = ANALYZE_SENTENCE_PROMPT.replace(
//     "{section}",
//     sentence.context.section,
//   )
//     .replace("{subsection}", sentence.context.subsection || "")
//     .replace("{paragraph}", sentence.context.paragraph)
//     .replace("{sentence}", sentence.text);

//   const model = (
//     await loadChatModel("gpt-4o-mini")
//   ).withStructuredOutput<AnalysisOutput>(analysisSchema, {
//     name: "analyze_sentence",
//   });

//   try {
//     const response = await model.invoke([
//       {
//         role: "system",
//         content: filledPrompt,
//       },
//     ]);

//     // If sentence doesn't need verification, continue to next sentence
//     if (!response.needs_verification) {
//       return new Command({
//         goto: "fetch_nextsentence",
//       });
//     }

//     // If it needs verification, store analysis and return to master agent
//     return new Command({
//       goto: "masterAgent",
//       update: {
//         analysisOutput: response,
//         messages: [
//           {
//             role: "system",
//             content: `Analyse des Satzes:\n${response.reasoning}\n\nGenerierte Suchanfrage: ${response.query}`,
//           },
//         ],
//       },
//     });
//   } catch (e) {
//     console.error("[AnalyzeSentence] Error:", e);
//     return new Command({
//       goto: "masterAgent",
//       update: {
//         analysisOutput: {
//           reasoning: "Fehler bei der Analyse des Satzes",
//           query: null,
//           needs_verification: false,
//         },
//         messages: [
//           {
//             role: "system",
//             content: "Es gab einen Fehler bei der Analyse des Satzes.",
//           },
//         ],
//       },
//     });
//   }
// }
