import type { UseMutationOptions } from '@tanstack/react-query';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type QueryConfig<T extends (...args: any[]) => any> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;

export type ApiFnReturnType<FnType extends (...args: any) => Promise<any>> = Awaited<
  ReturnType<FnType>
>;

export type MutationConfig<T extends (...args: any) => Promise<any>> = UseMutationOptions<
  ApiFnReturnType<T>,
  Error,
  Parameters<T>[0]
>;
