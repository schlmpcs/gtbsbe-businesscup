// View-model of the "What if?" hub (/tools): which tools exist is copy (copy/tools.ts); the live
// teasers come from hooks other screens already run.
export type ToolsHubVM = {
  /** Days until the next known bill (0 = today); null while loading or when no bill is known. */
  nextBillInDays: number | null;
};
