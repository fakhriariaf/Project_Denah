import { PgDeleteBase, PgUpdateBase, PgInsertBase, PgSelectBase } from "drizzle-orm/pg-core";

declare module "drizzle-orm/pg-core" {
  export interface PgDeleteBase<
    TTable,
    TQueryResult,
    TSelectedFields,
    TReturning,
    TDynamic,
    TExcludedMethods
  > {
    run(): this;
  }

  export interface PgUpdateBase<
    TTable,
    TQueryResult,
    TFrom,
    TSelectedFields,
    TReturning,
    TNullabilityMap,
    TJoins,
    TDynamic,
    TExcludedMethods
  > {
    run(): this;
  }

  export interface PgInsertBase<
    TTable,
    TQueryResult,
    TSelectedFields,
    TReturning,
    TDynamic,
    TExcludedMethods
  > {
    run(): this;
  }

  export interface PgSelectBase<
    TTableName,
    TSelection,
    TSelectMode,
    TNullabilityMap,
    TDynamic,
    TExcludedMethods,
    TResult,
    TSelectedFields
  > {
    all(): Promise<TResult>;
    get(): Promise<TResult extends any[] ? TResult[number] : TResult>;
  }
}
