export interface IHttpResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
  error?: unknown;
  headers: Record<string, string>;
  url: string;
}

export interface IAutocompleteResponse {
  data: {
    content: {
      text: string;
      records: {
        goods: unknown[];
      };
    };
  };
}

export interface IAutocompleteGood {
  title: string;
  href: string;
}
