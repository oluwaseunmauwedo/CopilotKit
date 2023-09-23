import { CopilotContext } from "@copilotkit/react-core";
import { useCallback, useContext } from "react";
import { MinimalChatGPTMessage } from "../../types";
import { retry } from "../../lib/retry";
import {
  EditingEditorState,
  Generator_InsertionOrEditingSuggestion,
  InsertionEditorApiConfig,
  InsertionEditorState,
} from "../../types/base/autosuggestions-bare-function";
import { InsertionsApiConfig } from "../../types/autosuggestions-config/insertions-api-config";
import { EditingApiConfig } from "../../types/autosuggestions-config/editing-api-config";

/**
 * Returns a memoized function that sends a request to the specified API endpoint to get an autosuggestion for the user's input.
 * The function takes in the text before and after the cursor, and an abort signal.
 * It sends a POST request to the API endpoint with the messages array containing the system message, few shot messages, and user messages.
 * The function returns the suggestion from the API response.
 *
 * @param textareaPurpose - The purpose of the textarea. This is included in the system message.
 * @param apiEndpoint - The API endpoint to send the autosuggestion request to.
 * @param makeSystemMessage - A function that takes in a context string and returns a system message to include in the autosuggestion request.
 * @param fewShotMessages - An array of few shot messages to include in the autosuggestion request.
 * @param contextCategories - The categories of context strings we want to include. By default, we include the (default) "global" context category.
 * @returns A memoized function that sends a request to the specified API endpoint to get an autosuggestion for the user's input.
 */
export function useMakeStandardInsertionOrEditingFunction(
  textareaPurpose: string,
  contextCategories: string[] | undefined,
  insertionApiConfig: InsertionsApiConfig,
  editingApiConfig: EditingApiConfig
): Generator_InsertionOrEditingSuggestion {
  const { getContextString } = useContext(CopilotContext);

  const insertionFunction = useCallback(
    async (
      editorState: EditingEditorState,
      insertionPrompt: string,
      abortSignal: AbortSignal
    ) => {
      const res = await retry(async () => {
        const messages: MinimalChatGPTMessage[] = [
          {
            role: "system",
            content: insertionApiConfig.makeSystemPrompt(
              textareaPurpose,
              getContextString(contextCategories)
            ),
          },
          ...insertionApiConfig.fewShotMessages,
          {
            role: "user",
            name: "TextAfterCursor",
            content: editorState.textAfterCursor,
          },
          {
            role: "user",
            name: "TextBeforeCursor",
            content: editorState.textBeforeCursor,
          },
          {
            role: "user",
            name: "InsertionPrompt",
            content: insertionPrompt,
          },
        ];

        return await insertionApiConfig.apiEndpoint.run(
          abortSignal,
          messages,
          insertionApiConfig.forwardedParams
        );
      });

      return res;
    },
    [insertionApiConfig, getContextString, contextCategories, textareaPurpose]
  );

  const editingFunction = useCallback(
    async (
      editorState: EditingEditorState,
      editingPrompt: string,
      abortSignal: AbortSignal
    ) => {
      const res = await retry(async () => {
        const messages: MinimalChatGPTMessage[] = [
          {
            role: "system",
            content: editingApiConfig.makeSystemPrompt(
              textareaPurpose,
              getContextString(contextCategories)
            ),
          },
          ...editingApiConfig.fewShotMessages,
          {
            role: "user",
            name: "TextBeforeCursor",
            content: editorState.textBeforeCursor,
          },
          {
            role: "user",
            name: "TextToEdit",
            content: editorState.selectedText,
          },
          {
            role: "user",
            name: "TextAfterCursor",
            content: editorState.textAfterCursor,
          },
          {
            role: "user",
            name: "EditingPrompt",
            content: editingPrompt,
          },
        ];

        return await editingApiConfig.apiEndpoint.run(
          abortSignal,
          messages,
          editingApiConfig.forwardedParams
        );
      });

      return res;
    },
    [editingApiConfig, getContextString, contextCategories, textareaPurpose]
  );

  const insertionOrEditingFunction = useCallback(
    async (
      editorState: EditingEditorState,
      insertionPrompt: string,
      abortSignal: AbortSignal
    ) => {
      if (editorState.selectedText === "") {
        return await insertionFunction(
          editorState,
          insertionPrompt,
          abortSignal
        );
      } else {
        return await editingFunction(editorState, insertionPrompt, abortSignal);
      }
    },
    [insertionFunction, editingFunction]
  );

  return insertionOrEditingFunction;
}
