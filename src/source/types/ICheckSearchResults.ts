export type CheckSearchResultsParams = {
  strategy: string;
  linkSelector: string;
  emptySelector?: string;
  emptySelectorText?: string;
};

export type SearchResult = {
  productUrl: string;
};
