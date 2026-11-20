import { Braces, CircleCheck, CircleMinus, CircleSlash, Split, Target } from 'lucide-react'
import type { RelevancyIdT, TypeIdT } from '../data/schema'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* one colour per question type, always paired with a label and an icon */
export const TYPE_STYLE: Record<TypeIdT, { text: string; bg: string; border: string; rail: string; Icon: typeof Split }> = {
  answerable: { text: 'text-answerable', bg: 'bg-answerable-soft', border: 'border-answerable', rail: 'bg-answerable', Icon: CircleCheck },
  ambiguous: { text: 'text-ambiguous', bg: 'bg-ambiguous-soft', border: 'border-ambiguous', rail: 'bg-ambiguous', Icon: Split },
  unanswerable: { text: 'text-unanswerable', bg: 'bg-unanswerable-soft', border: 'border-unanswerable', rail: 'bg-unanswerable', Icon: CircleSlash },
}

export const REL_STYLE: Record<RelevancyIdT, { text: string; bg: string; border: string; Icon: typeof Target }> = {
  relevant: { text: 'text-relevant', bg: 'bg-relevant-soft', border: 'border-relevant', Icon: Target },
  technical: { text: 'text-technical', bg: 'bg-technical-soft', border: 'border-technical', Icon: Braces },
  irrelevant: { text: 'text-irrelevant', bg: 'bg-irrelevant-soft', border: 'border-irrelevant', Icon: CircleMinus },
}
