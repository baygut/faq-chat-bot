CREATE TABLE IF NOT EXISTS "Faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"confidence" text
);
