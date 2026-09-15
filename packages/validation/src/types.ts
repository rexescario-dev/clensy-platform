export type RuleString = string;
export type Rules<T extends object> = Partial<Record<keyof T, RuleString>>;
export type FieldErrors = Record<string, string[]>;

export interface ValidateOptions {
  attributes?: Record<string, string>;
  messages?: Partial<Record<string, string>>;
}
