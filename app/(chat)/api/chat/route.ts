import {
    type CoreAssistantMessage,
    type CoreSystemMessage,
    type CoreToolMessage,
    type CoreUserMessage,
    type Message,
    StreamData,
    convertToCoreMessages,
    streamObject,
    streamText,
} from "ai";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { customModel } from "@/lib/ai";
import { models } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import {
    deleteChatById,
    getChatById,
    getDocumentById,
    saveChat,
    saveDocument,
    saveMessages,
    saveSuggestions,
    saveFaq,
    getFaqAnswer,
    getFaqSuggestions,
} from "@/lib/db/queries";
import type { Suggestion } from "@/lib/db/schema";
import {
    generateUUID,
    getMostRecentUserMessage,
    sanitizeResponseMessages,
} from "@/lib/utils";

import { generateTitleFromUserMessage } from "../../actions";

export const maxDuration = 60;

type AllowedTools =
    | "createDocument"
    | "updateDocument"
    | "requestSuggestions"
    | "getWeather"
    | "saveFaq"
    | "answerFaq"
    | "getFaqSuggestions";

const blocksTools: AllowedTools[] = [
    "createDocument",
    "updateDocument",
    "requestSuggestions",
];

const weatherTools: AllowedTools[] = ["getWeather"];

const faqTools: AllowedTools[] = ["saveFaq", "answerFaq", "getFaqSuggestions"];

const allTools: AllowedTools[] = [...blocksTools, ...weatherTools, ...faqTools];

export async function POST(request: Request) {
    const {
        id,
        messages,
        modelId,
    }: { id: string; messages: Array<Message>; modelId: string } =
        await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return new Response("Unauthorized", { status: 401 });
    }

    const model = models.find((model) => model.id === modelId);

    if (!model) {
        return new Response("Model not found", { status: 404 });
    }

    const coreMessages = convertToCoreMessages(messages);
    const userMessage = getMostRecentUserMessage(coreMessages);

    if (!userMessage) {
        return new Response("No user message found", { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
        const title = await generateTitleFromUserMessage({
            message: userMessage,
        });
        await saveChat({ id, userId: session.user.id, title });
    }

    const userMessageId = generateUUID();

    await saveMessages({
        messages: [
            {
                ...userMessage,
                id: userMessageId,
                createdAt: new Date(),
                chatId: id,
            },
        ],
    });

    const streamingData = new StreamData();

    streamingData.append({
        type: "user-message-id",
        content: userMessageId,
    });

    // Get all FAQs for context
    const faqs = await getFaqAnswer({ question: "" });
    const faqContext = faqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n");

    // Add a utility function to convert complex messages to simple string messages
    const convertMessageToStringContent = (
        message:
            | CoreSystemMessage
            | CoreUserMessage
            | CoreAssistantMessage
            | CoreToolMessage
            | { role: string; content: string }
    ): { role: string; content: string } => {
        if (typeof message.content === "string") {
            return message as { role: string; content: string };
        }

        // If content is an array, convert it to a string
        const stringContent = message.content
            .map((part) => {
                if ("text" in part) return part.text;
                if ("image" in part) return `[Image: ${part.image}]`;
                if ("file" in part) return `[File: ${part.file}]`;
                return "";
            })
            .join(" ");

        return {
            role: message.role,
            content: stringContent,
        };
    };

    const faqPrompt = {
        role: "system",
        content: `Here are some relevant FAQs for context:\n\n${faqContext}\n\nUse this information to help answer the question if relevant.`,
    };

    const result = streamText({
        model: customModel(model.apiIdentifier),
        system: systemPrompt,
        messages: [...coreMessages, faqPrompt] as any,
        maxSteps: 5,
        experimental_activeTools: allTools,
        tools: {
            getWeather: {
                description: "Get the current weather at a location",
                parameters: z.object({
                    latitude: z.number(),
                    longitude: z.number(),
                }),
                execute: async ({ latitude, longitude }) => {
                    const response = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
                    );

                    const weatherData = await response.json();
                    return weatherData;
                },
            },
            createDocument: {
                description: "Create a document for a writing activity",
                parameters: z.object({
                    title: z.string(),
                }),
                execute: async ({ title }) => {
                    const id = generateUUID();
                    let draftText = "";

                    streamingData.append({
                        type: "id",
                        content: id,
                    });

                    streamingData.append({
                        type: "title",
                        content: title,
                    });

                    streamingData.append({
                        type: "clear",
                        content: "",
                    });

                    const { fullStream } = streamText({
                        model: customModel(model.apiIdentifier),
                        system: "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
                        prompt: title,
                    });

                    for await (const delta of fullStream) {
                        const { type } = delta;

                        if (type === "text-delta") {
                            const { textDelta } = delta;

                            draftText += textDelta;
                            streamingData.append({
                                type: "text-delta",
                                content: textDelta,
                            });
                        }
                    }

                    streamingData.append({ type: "finish", content: "" });

                    if (session.user?.id) {
                        await saveDocument({
                            id,
                            title,
                            content: draftText,
                            userId: session.user.id,
                        });
                    }

                    return {
                        id,
                        title,
                        content:
                            "A document was created and is now visible to the user.",
                    };
                },
            },
            updateDocument: {
                description: "Update a document with the given description",
                parameters: z.object({
                    id: z.string().describe("The ID of the document to update"),
                    description: z
                        .string()
                        .describe(
                            "The description of changes that need to be made"
                        ),
                }),
                execute: async ({ id, description }) => {
                    const document = await getDocumentById({ id });

                    if (!document) {
                        return {
                            error: "Document not found",
                        };
                    }

                    const { content: currentContent } = document;
                    let draftText = "";

                    streamingData.append({
                        type: "clear",
                        content: document.title,
                    });

                    const { fullStream } = streamText({
                        model: customModel(model.apiIdentifier),
                        system: "You are a helpful writing assistant. Based on the description, please update the piece of writing.",
                        experimental_providerMetadata: {
                            openai: {
                                prediction: {
                                    type: "content",
                                    content: currentContent,
                                },
                            },
                        },
                        messages: [
                            {
                                role: "user",
                                content: description,
                            },
                            { role: "user", content: currentContent },
                        ],
                    });

                    for await (const delta of fullStream) {
                        const { type } = delta;

                        if (type === "text-delta") {
                            const { textDelta } = delta;

                            draftText += textDelta;
                            streamingData.append({
                                type: "text-delta",
                                content: textDelta,
                            });
                        }
                    }

                    streamingData.append({ type: "finish", content: "" });

                    if (session.user?.id) {
                        await saveDocument({
                            id,
                            title: document.title,
                            content: draftText,
                            userId: session.user.id,
                        });
                    }

                    return {
                        id,
                        title: document.title,
                        content: "The document has been updated successfully.",
                    };
                },
            },
            requestSuggestions: {
                description: "Request suggestions for a document",
                parameters: z.object({
                    documentId: z
                        .string()
                        .describe("The ID of the document to request edits"),
                }),
                execute: async ({ documentId }) => {
                    const document = await getDocumentById({ id: documentId });

                    if (!document || !document.content) {
                        return {
                            error: "Document not found",
                        };
                    }

                    const suggestions: Array<
                        Omit<
                            Suggestion,
                            "userId" | "createdAt" | "documentCreatedAt"
                        >
                    > = [];

                    const { elementStream } = streamObject({
                        model: customModel(model.apiIdentifier),
                        system: "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
                        prompt: document.content,
                        output: "array",
                        schema: z.object({
                            originalSentence: z
                                .string()
                                .describe("The original sentence"),
                            suggestedSentence: z
                                .string()
                                .describe("The suggested sentence"),
                            description: z
                                .string()
                                .describe("The description of the suggestion"),
                        }),
                    });

                    for await (const element of elementStream) {
                        const suggestion = {
                            originalText: element.originalSentence,
                            suggestedText: element.suggestedSentence,
                            description: element.description,
                            id: generateUUID(),
                            documentId: documentId,
                            isResolved: false,
                        };

                        streamingData.append({
                            type: "suggestion",
                            content: suggestion,
                        });

                        suggestions.push(suggestion);
                    }

                    if (session.user?.id) {
                        const userId = session.user.id;

                        await saveSuggestions({
                            suggestions: suggestions.map((suggestion) => ({
                                ...suggestion,
                                userId,
                                createdAt: new Date(),
                                documentCreatedAt: document.createdAt,
                            })),
                        });
                    }

                    return {
                        id: documentId,
                        title: document.title,
                        message: "Suggestions have been added to the document",
                    };
                },
            },
            saveFaq: {
                description: "Save a FAQ entry to the database",
                parameters: z.object({
                    question: z.string().describe("The question to save"),
                    answer: z.string().describe("The answer to save"),
                }),
                execute: async ({ question, answer }) => {
                    try {
                        await saveFaq({ question, answer });
                        return {
                            success: true,
                            message: "FAQ saved successfully",
                        };
                    } catch (error) {
                        return {
                            success: false,
                            message: "Failed to save FAQ",
                        };
                    }
                },
            },
            answerFaq: {
                description: "Get answer for a frequently asked question",
                parameters: z.object({
                    question: z
                        .string()
                        .describe("The question to find an answer for"),
                }),
                execute: async ({ question }) => {
                    try {
                        const faqAnswer = await getFaqAnswer({ question });
                        if (faqAnswer && faqAnswer.length > 0) {
                            // Find the most relevant FAQ or use the first one
                            const mostRelevantFaq = faqAnswer[0];
                            return {
                                success: true,
                                answer: mostRelevantFaq.answer,
                                source: "faq",
                            };
                        }
                        return {
                            success: false,
                            message: "No matching FAQ found for this question",
                            source: "faq",
                        };
                    } catch (error) {
                        return {
                            success: false,
                            message: "Failed to retrieve FAQ answer",
                            source: "faq",
                        };
                    }
                },
            },
            getFaqSuggestions: {
                description: "Get suggested frequently asked questions",
                parameters: z.object({}),
                execute: async () => {
                    try {
                        const suggestions = await getFaqSuggestions();
                        return {
                            success: true,
                            suggestions: suggestions.map((s) => ({
                                question: s.question,
                                category: s.category,
                            })),
                        };
                    } catch (error) {
                        return {
                            success: false,
                            message: "Failed to retrieve FAQ suggestions",
                        };
                    }
                },
            },
        },
        onFinish: async ({ response }) => {
            if (session.user?.id) {
                try {
                    const responseMessagesWithoutIncompleteToolCalls =
                        sanitizeResponseMessages(response.messages);

                    await saveMessages({
                        messages:
                            responseMessagesWithoutIncompleteToolCalls.map(
                                (message) => {
                                    const messageId = generateUUID();

                                    if (message.role === "assistant") {
                                        streamingData.appendMessageAnnotation({
                                            messageIdFromServer: messageId,
                                        });
                                    }

                                    return {
                                        id: messageId,
                                        chatId: id,
                                        role: message.role,
                                        content: message.content,
                                        createdAt: new Date(),
                                    };
                                }
                            ),
                    });
                } catch (error) {
                    console.error("Failed to save chat");
                }
            }

            streamingData.close();
        },
        experimental_telemetry: {
            isEnabled: true,
            functionId: "stream-text",
        },
    });

    return result.toDataStreamResponse({
        data: streamingData,
    });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return new Response("Not Found", { status: 404 });
    }

    const session = await auth();

    if (!session || !session.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const chat = await getChatById({ id });

        if (chat.userId !== session.user.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        await deleteChatById({ id });

        return new Response("Chat deleted", { status: 200 });
    } catch (error) {
        return new Response("An error occurred while processing your request", {
            status: 500,
        });
    }
}
