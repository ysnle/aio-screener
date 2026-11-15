// The words by which a headline states which way a price moved. One list for the day account's "does this report agree
// with the move" rule, the mover headline pick and the headline stance count.
export const UP_WORDS = /\b(?:rise[sn]?|rising|jump(?:s|ed)?|gain(?:s|ed)?|surg(?:e[sd]?|ing)|soar(?:s|ed|ing)?|rall(?:y|ies|ied|ying)|higher|climb(?:s|ed)?)\b|(?<![가-힣])(?:상승|급등|강세)/i;
export const DOWN_WORDS = /\b(?:fall(?:s|en)?|fell|drop(?:s|ped)?|slide[sd]?|slid|tumbl(?:e|es|ed|ing)|sinks?|sank|plung(?:e[sd]?|ing)|lower|slump(?:s|ed)?|dips?)\b|(?<![가-힣])(?:하락|급락|약세)/i;
