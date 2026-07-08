import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as dataRulesApi from '../../services/api/dataRulesApi';
import type {
    BulkReplacePayload,
    BulkReplaceResponse,
    CreateDataRulePayload,
    DataRule,
    DataRuleDeleteResponse,
    DataRuleFilters,
    DataRuleListResponse,
    DataRuleResourcesResponse,
    DataRuleScopesResponse,
    DenyBySubjectCodePayload,
    RevokeDenyResponse,
    UpdateDataRulePayload,
    WildcardDenyErrorResponse,
} from '../../types/dataRules.types';
import type { DataRuleScopeType, DataRuleModelType } from '../../types/dataRules.types';

export const DATA_RULES_BASE_KEY = ['data-rules'] as const;

export const dataRuleKeys = {
    all: DATA_RULES_BASE_KEY,
    lists: () => [...DATA_RULES_BASE_KEY, 'list'] as const,
    list: (filters: DataRuleFilters) => [...dataRuleKeys.lists(), filters] as const,
    detail: (id: number) => [...DATA_RULES_BASE_KEY, id] as const,
    scopes: (scopeType: DataRuleScopeType) => [...DATA_RULES_BASE_KEY, 'scopes', scopeType] as const,
    resources: (modelType: DataRuleModelType) => [...DATA_RULES_BASE_KEY, 'resources', modelType] as const,
};

// ─── List ────────────────────────────────────────────────────────────────────

export function useDataRules(filters: DataRuleFilters = {}) {
    return useQuery<DataRuleListResponse>({
        queryKey: dataRuleKeys.list(filters),
        queryFn: () => dataRulesApi.getDataRules(filters),
    });
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function useDataRule(id: number | null) {
    return useQuery<DataRule>({
        queryKey: id !== null ? dataRuleKeys.detail(id) : ['data-rules', 'noop'],
        queryFn: () => dataRulesApi.getDataRule(id as number),
        enabled: id !== null,
    });
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export function useDataRuleScopes(scopeType: DataRuleScopeType | undefined) {
    return useQuery<DataRuleScopesResponse>({
        queryKey: scopeType ? dataRuleKeys.scopes(scopeType) : ['data-rules', 'scopes', 'noop'],
        queryFn: () => dataRulesApi.getDataRuleScopes(scopeType as DataRuleScopeType),
        enabled: scopeType !== undefined,
    });
}

export function useDataRuleResources(modelType: DataRuleModelType | undefined) {
    return useQuery<DataRuleResourcesResponse>({
        queryKey: modelType ? dataRuleKeys.resources(modelType) : ['data-rules', 'resources', 'noop'],
        queryFn: () => dataRulesApi.getDataRuleResources(modelType as DataRuleModelType),
        enabled: modelType !== undefined,
    });
}

// ─── Create ──────────────────────────────────────────────────────────────────

export function useCreateDataRule() {
    const queryClient = useQueryClient();

    return useMutation<DataRule, AxiosError, CreateDataRulePayload>({
        mutationFn: (payload) => dataRulesApi.createDataRule(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateDataRule(id: number) {
    const queryClient = useQueryClient();

    return useMutation<DataRule, AxiosError, UpdateDataRulePayload>({
        mutationFn: (payload) => dataRulesApi.updateDataRule(id, payload),
        onSuccess: (rule) => {
            queryClient.setQueryData(dataRuleKeys.detail(id), rule);
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteDataRule() {
    const queryClient = useQueryClient();

    return useMutation<DataRuleDeleteResponse, AxiosError, number>({
        mutationFn: (ruleId) => dataRulesApi.deleteDataRule(ruleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

// ─── Deny by subject code ─────────────────────────────────────────────────────

export function useDenyBySubjectCode() {
    const queryClient = useQueryClient();

    return useMutation<DataRule, AxiosError, DenyBySubjectCodePayload>({
        mutationFn: (payload) => dataRulesApi.denyBySubjectCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

export function useRevokeDenyBySubjectCode() {
    const queryClient = useQueryClient();

    return useMutation<RevokeDenyResponse, AxiosError, DenyBySubjectCodePayload>({
        mutationFn: (payload) => dataRulesApi.revokeDenyBySubjectCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

// ─── Bulk replace ─────────────────────────────────────────────────────────────

export function useBulkReplaceDataRules() {
    const queryClient = useQueryClient();

    return useMutation<BulkReplaceResponse, AxiosError, BulkReplacePayload>({
        mutationFn: (payload) => dataRulesApi.bulkReplaceDataRules(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dataRuleKeys.all });
        },
    });
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function isWildcardDenyConfirmationError(error: unknown): error is AxiosError<WildcardDenyErrorResponse> {
    const err = error as AxiosError<WildcardDenyErrorResponse> | undefined;
    if (!err || !err.response) return false;
    return err.response.status === 422 && err.response.data?.requires === 'confirm_wildcard_deny';
}
