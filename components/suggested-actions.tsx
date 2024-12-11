"use client";
import { Button } from "./ui/button";
import type { ChatRequestOptions, CreateMessage, Message } from "ai";
import { memo } from "react";
import useSWR from "swr";

interface SuggestedActionsProps {
    chatId: string;
    append: (
        message: Message | CreateMessage,
        chatRequestOptions?: ChatRequestOptions
    ) => Promise<string | null | undefined>;
    isLoading?: boolean;
    messages?: Message[];
}

function PureSuggestedActions({
    chatId,
    append,
    isLoading = false,
    messages = [],
}: SuggestedActionsProps) {
    const { data, error } = useSWR("/api/faq", async () => {
        const response = await fetch("/api/faq");
        if (!response.ok) {
            throw new Error("Failed to fetch FAQs");
        }
        const data = await response.json();
        return data.faqs;
    });

    // Don't show FAQs if there are messages or no FAQs available
    if (messages.length > 0 || !data?.length) {
        return null;
    }

    if (error) {
        return (
            <div className="flex flex-col space-y-2 w-full rounded-lg bg-muted p-4">
                <h3 className="text-sm font-semibold">
                    Error fetching FAQ suggestions
                </h3>
                <p>{error.message}</p>
            </div>
        );
    }

    return (
        <></>
        // <div className="flex flex-col space-y-2 w-full rounded-lg bg-muted p-4">
        //     {/* <h3 className="text-sm font-semibold">
        //         Frequently Asked Questions
        //     </h3>
        //     <div className="flex flex-wrap gap-2">
        //         {data.map((faq: { question: string; id: string }) => (
        //             <Button
        //                 key={faq.id}
        //                 onClick={() => handleFaqClick(faq.question)}
        //                 variant="default"
        //                 className="rounded-full"
        //                 disabled={isLoading}
        //             >
        //                 {faq.question}
        //             </Button>
        //         ))}
        //     </div> */}
        // </div>
    );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
