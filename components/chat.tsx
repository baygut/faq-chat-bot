"use client";

import type { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useWindowSize } from "usehooks-ts";
import { toast } from "sonner";

import { ChatHeader } from "@/components/chat-header";

import { Block, type UIBlock } from "./block";
import { BlockStreamHandler } from "./block-stream-handler";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
    id,
    initialMessages,
    selectedModelId,
    selectedVisibilityType,
    isReadonly,
}: {
    id: string;
    initialMessages: Array<Message>;
    selectedModelId: string;
    selectedVisibilityType: VisibilityType;
    isReadonly: boolean;
}) {
    const [faqSuggestions, setFaqSuggestions] = useState<
        Array<{ question: string; category: string | null }>
    >([]);

    const {
        messages,
        setMessages,
        handleSubmit,
        input,
        setInput,
        append,
        isLoading,
        stop,
        reload,
        data: streamingData,
    } = useChat({
        id,
        body: { id, modelId: selectedModelId },
        initialMessages,
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const faqQuestion = params.get("faq");

        if (faqQuestion && messages.length === 0) {
            append({
                role: "user",
                content: decodeURIComponent(faqQuestion),
            });
        }
    }, []);

    const { width: windowWidth = 1920, height: windowHeight = 1080 } =
        useWindowSize();

    const [block, setBlock] = useState<UIBlock>({
        documentId: "init",
        content: "",
        title: "",
        status: "idle",
        isVisible: false,
        boundingBox: {
            top: windowHeight / 4,
            left: windowWidth / 4,
            width: 250,
            height: 50,
        },
    });

    const [attachments, setAttachments] = useState<Array<Attachment>>([]);

    return (
        <>
            <div className="flex flex-col min-w-0 h-dvh bg-background">
                <ChatHeader
                    chatId={id}
                    selectedModelId={selectedModelId}
                    selectedVisibilityType={selectedVisibilityType}
                    isReadonly={isReadonly}
                />

                <div className="relative flex-1 overflow-hidden bg-background px-4">
                    <Messages
                        votes={[]}
                        chatId={id}
                        block={block}
                        setBlock={setBlock}
                        isLoading={isLoading}
                        messages={messages}
                        setMessages={setMessages}
                        reload={reload}
                        isReadonly={isReadonly}
                    />
                </div>

                <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
                    {!isReadonly && (
                        <MultimodalInput
                            chatId={id}
                            input={input}
                            setInput={setInput}
                            handleSubmit={handleSubmit}
                            isLoading={isLoading}
                            stop={stop}
                            attachments={attachments}
                            setAttachments={setAttachments}
                            messages={messages}
                            setMessages={setMessages}
                            append={append}
                        />
                    )}
                </form>
            </div>

            <AnimatePresence>
                {block?.isVisible && (
                    <Block
                        votes={[]}
                        chatId={id}
                        input={input}
                        setInput={setInput}
                        handleSubmit={handleSubmit}
                        isLoading={isLoading}
                        stop={stop}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        append={append}
                        block={block}
                        setBlock={setBlock}
                        messages={messages}
                        setMessages={setMessages}
                        reload={reload}
                        isReadonly={isReadonly}
                    />
                )}
            </AnimatePresence>

            <BlockStreamHandler
                streamingData={streamingData}
                setBlock={setBlock}
            />
        </>
    );
}
