import { motion } from "framer-motion";
import Link from "next/link";

import { MessageIcon, VercelIcon } from "./icons";
import Image from "next/image";

export const Overview = () => {
    return (
        <motion.div
            key="overview"
            className="max-w-3xl mx-auto md:mt-20"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ delay: 0.5 }}
        >
            <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
                <div className="relative w-full h-44">
                    <Image
                        src="/logo.png"
                        alt="Chanswer Logo"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
                <p>
                    Hello! I am Chanswer, a chatbot powered by{" "}
                    <Link
                        className="font-medium underline underline-offset-4"
                        href="https://vercel.com/products/functions"
                        target="_blank"
                    >
                        Vercel Functions
                    </Link>
                    ,{" "}
                    <Link
                        className="font-medium underline underline-offset-4"
                        href="https://sdk.vercel.ai/docs"
                        target="_blank"
                    >
                        AI SDK
                    </Link>
                    , and{" "}
                    <Link
                        className="font-medium underline underline-offset-4"
                        href="https://nextjs.org/docs/app/building-your-application/routing"
                        target="_blank"
                    >
                        Next.js 14 and App Router
                    </Link>
                    .
                </p>
                <p>
                    I am an FAQ chatbot built by{" "}
                    <Link
                        className="font-medium underline underline-offset-4"
                        href="https://github.com/baygut"
                        target="_blank"
                    >
                        Berkay Baygut
                    </Link>{" "}
                    and{" "}
                    <Link
                        className="font-medium underline underline-offset-4"
                        href="https://github.com/metehaninal"
                        target="_blank"
                    >
                        Metehan Inal
                    </Link>
                </p>
                <p>
                    You can start a conversation with choosing an FAQ or ask a
                    question directly.
                </p>
            </div>
        </motion.div>
    );
};
