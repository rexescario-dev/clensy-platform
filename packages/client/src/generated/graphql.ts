/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
const defaultOptions = {} as const;
export type CreateAdminInput = {
  email: string;
  password: string;
  role: Role;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type Role =
  | 'ANALYST'
  | 'CUSTOMER_SUPPORT'
  | 'FINANCE'
  | 'OPS_MANAGER'
  | 'OWNER'
  | 'SCHEDULER';

export type AdminsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminsQuery = { admins: Array<{ id: string, email: string, role: Role, isActive: boolean }> };

export type CreateAdminMutationVariables = Exact<{
  createAdminInput: CreateAdminInput;
}>;


export type CreateAdminMutation = { createAdmin: { id: string, email: string, role: Role, isActive: boolean } };

export type CurrentAdminQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentAdminQuery = { currentAdmin: { id: string, role: Role } };

export type DisableAdminMutationVariables = Exact<{
  id: string | number;
}>;


export type DisableAdminMutation = { disableAdmin: { id: string, email: string, role: Role, isActive: boolean } };

export type LoginMutationVariables = Exact<{
  loginInput: LoginInput;
}>;


export type LoginMutation = { login: { success: boolean, admin: { id: string, role: Role } } };


export const AdminsDocument = gql`
    query Admins {
  admins {
    id
    email
    role
    isActive
  }
}
    `;

/**
 * __useAdminsQuery__
 *
 * To run a query within a React component, call `useAdminsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAdminsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAdminsQuery({
 *   variables: {
 *   },
 * });
 */
export function useAdminsQuery(baseOptions?: Apollo.QueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
      }
export function useAdminsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
        }
// @ts-ignore
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminsQuery, AdminsQueryVariables>;
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminsQuery | undefined, AdminsQueryVariables>;
export function useAdminsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminsQuery, AdminsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AdminsQuery, AdminsQueryVariables>(AdminsDocument, options);
        }
export type AdminsQueryHookResult = ReturnType<typeof useAdminsQuery>;
export type AdminsLazyQueryHookResult = ReturnType<typeof useAdminsLazyQuery>;
export type AdminsSuspenseQueryHookResult = ReturnType<typeof useAdminsSuspenseQuery>;
export type AdminsQueryResult = Apollo.QueryResult<AdminsQuery, AdminsQueryVariables>;
export const CreateAdminDocument = gql`
    mutation CreateAdmin($createAdminInput: CreateAdminInput!) {
  createAdmin(createAdminInput: $createAdminInput) {
    id
    email
    role
    isActive
  }
}
    `;
export type CreateAdminMutationFn = Apollo.MutationFunction<CreateAdminMutation, CreateAdminMutationVariables>;

/**
 * __useCreateAdminMutation__
 *
 * To run a mutation, you first call `useCreateAdminMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateAdminMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createAdminMutation, { data, loading, error }] = useCreateAdminMutation({
 *   variables: {
 *      createAdminInput: // value for 'createAdminInput'
 *   },
 * });
 */
export function useCreateAdminMutation(baseOptions?: Apollo.MutationHookOptions<CreateAdminMutation, CreateAdminMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateAdminMutation, CreateAdminMutationVariables>(CreateAdminDocument, options);
      }
export type CreateAdminMutationHookResult = ReturnType<typeof useCreateAdminMutation>;
export type CreateAdminMutationResult = Apollo.MutationResult<CreateAdminMutation>;
export type CreateAdminMutationOptions = Apollo.BaseMutationOptions<CreateAdminMutation, CreateAdminMutationVariables>;
export const CurrentAdminDocument = gql`
    query CurrentAdmin {
  currentAdmin {
    id
    role
  }
}
    `;

/**
 * __useCurrentAdminQuery__
 *
 * To run a query within a React component, call `useCurrentAdminQuery` and pass it any options that fit your needs.
 * When your component renders, `useCurrentAdminQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCurrentAdminQuery({
 *   variables: {
 *   },
 * });
 */
export function useCurrentAdminQuery(baseOptions?: Apollo.QueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
      }
export function useCurrentAdminLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
        }
// @ts-ignore
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>): Apollo.UseSuspenseQueryResult<CurrentAdminQuery, CurrentAdminQueryVariables>;
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>): Apollo.UseSuspenseQueryResult<CurrentAdminQuery | undefined, CurrentAdminQueryVariables>;
export function useCurrentAdminSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CurrentAdminQuery, CurrentAdminQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CurrentAdminQuery, CurrentAdminQueryVariables>(CurrentAdminDocument, options);
        }
export type CurrentAdminQueryHookResult = ReturnType<typeof useCurrentAdminQuery>;
export type CurrentAdminLazyQueryHookResult = ReturnType<typeof useCurrentAdminLazyQuery>;
export type CurrentAdminSuspenseQueryHookResult = ReturnType<typeof useCurrentAdminSuspenseQuery>;
export type CurrentAdminQueryResult = Apollo.QueryResult<CurrentAdminQuery, CurrentAdminQueryVariables>;
export const DisableAdminDocument = gql`
    mutation DisableAdmin($id: ID!) {
  disableAdmin(id: $id) {
    id
    email
    role
    isActive
  }
}
    `;
export type DisableAdminMutationFn = Apollo.MutationFunction<DisableAdminMutation, DisableAdminMutationVariables>;

/**
 * __useDisableAdminMutation__
 *
 * To run a mutation, you first call `useDisableAdminMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDisableAdminMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [disableAdminMutation, { data, loading, error }] = useDisableAdminMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDisableAdminMutation(baseOptions?: Apollo.MutationHookOptions<DisableAdminMutation, DisableAdminMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DisableAdminMutation, DisableAdminMutationVariables>(DisableAdminDocument, options);
      }
export type DisableAdminMutationHookResult = ReturnType<typeof useDisableAdminMutation>;
export type DisableAdminMutationResult = Apollo.MutationResult<DisableAdminMutation>;
export type DisableAdminMutationOptions = Apollo.BaseMutationOptions<DisableAdminMutation, DisableAdminMutationVariables>;
export const LoginDocument = gql`
    mutation Login($loginInput: LoginInput!) {
  login(loginInput: $loginInput) {
    success
    admin {
      id
      role
    }
  }
}
    `;
export type LoginMutationFn = Apollo.MutationFunction<LoginMutation, LoginMutationVariables>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      loginInput: // value for 'loginInput'
 *   },
 * });
 */
export function useLoginMutation(baseOptions?: Apollo.MutationHookOptions<LoginMutation, LoginMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument, options);
      }
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<LoginMutation, LoginMutationVariables>;