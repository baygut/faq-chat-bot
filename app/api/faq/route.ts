import { getFaqSuggestions } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const faqs = await getFaqSuggestions();
    return NextResponse.json({ faqs });
  } catch (error) {
    console.error('Failed to fetch FAQs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FAQs' },
      { status: 500 }
    );
  }
}
