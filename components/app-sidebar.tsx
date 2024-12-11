"use client";

import type { User } from "next-auth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";

import { PlusIcon } from "@/components/icons";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface FaqSuggestion {
    question: string;
    category?: string;
    id: string;
}

export function AppSidebar({ user }: { user: User | undefined }) {
    const router = useRouter();
    const { setOpenMobile } = useSidebar();
    const [faqSuggestions, setFaqSuggestions] = useState<FaqSuggestion[]>([]);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const response = await fetch("/api/faq");
                if (!response.ok) {
                    throw new Error("Failed to fetch FAQs");
                }
                const data = await response.json();
                if (data.faqs) {
                    setFaqSuggestions(data.faqs);
                }
            } catch (error) {
                console.error("Failed to fetch FAQ suggestions:", error);
            }
        };

        fetchFaqs();
    }, []);

    const handleFaqClick = (question: string) => {
        setOpenMobile(false);
        // Create a clean URL with the FAQ parameter
        const url = new URL("/", window.location.origin);
        url.searchParams.set("faq", question);
        router.push(url.toString());
    };

    return (
        <Sidebar className="group-data-[side=left]:border-r-0">
            <SidebarHeader>
                <SidebarMenu>
                    <div className="flex flex-row justify-between items-center">
                        <Link
                            href="/"
                            onClick={() => {
                                setOpenMobile(false);
                            }}
                            className="flex flex-row gap-3 items-center"
                        >
                            <div className="relative w-48 h-12">
                                <Image
                                    src="/logo.png"
                                    alt="Chanswer Logo"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </Link>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    type="button"
                                    className="p-2 h-fit"
                                    onClick={() => {
                                        setOpenMobile(false);
                                        router.push("/");
                                    }}
                                >
                                    <PlusIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent align="end">
                                New Chat
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <div className="flex flex-col gap-4 p-4">
                    <h3 className="text-lg font-semibold">
                        Frequently Asked Questions
                    </h3>
                    <div className="flex flex-col gap-2">
                        {faqSuggestions.map((suggestion) => (
                            <button
                                key={suggestion.id}
                                onClick={() =>
                                    handleFaqClick(suggestion.question)
                                }
                                className="text-left p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                {suggestion.question}
                            </button>
                        ))}
                    </div>
                </div>
            </SidebarContent>
            <SidebarFooter>
                {user && <SidebarUserNav user={user} />}
            </SidebarFooter>
        </Sidebar>
    );
}
