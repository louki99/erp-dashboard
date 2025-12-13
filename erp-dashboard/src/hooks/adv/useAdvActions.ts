import { useState } from 'react';
import toast from 'react-hot-toast';
import { advApi } from '@/services/api/advApi';
import type {
    PartnerValidationRequest,
    PartnerRejectionRequest,
    CreditLimitUpdateRequest,
    PartnerBlockRequest,
    BCApprovalRequest,
    BCRejectionRequest,
    BCHoldRequest,
    BCRequestInfoRequest,
    BCBatchApprovalRequest,
    DerogationRequest,
    DerogationApprovalRequest,
    DerogationRejectionRequest,
    ApiSuccessResponse,
} from '@/types/adv.types';

/**
 * Generic mutation hook factory
 */
const useMutation = <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: {
        onSuccess?: (data: TData, variables: TVariables) => void;
        onError?: (error: Error, variables: TVariables) => void;
        successMessage?: string;
        errorMessage?: string;
    }
) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<TData | null>(null);

    const mutate = async (variables: TVariables) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await mutationFn(variables);
            setData(result);

            if (options?.successMessage) {
                toast.success(options.successMessage);
            }

            options?.onSuccess?.(result, variables);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Une erreur est survenue');
            setError(error);

            if (options?.errorMessage) {
                toast.error(options.errorMessage);
            } else if (err instanceof Error) {
                toast.error(err.message);
            }

            options?.onError?.(error, variables);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return { mutate, isLoading, error, data };
};

// ==================== Partner Actions ====================

/**
 * Hook to validate a pending partner
 */
export const useValidatePartner = (options?: {
    onSuccess?: (data: ApiSuccessResponse, partnerId: number) => void;
}) => {
    return useMutation(
        async ({ partnerId, data }: { partnerId: number; data: PartnerValidationRequest }) =>
            advApi.partners.validate(partnerId, data),
        {
            successMessage: 'Partenaire validé avec succès',
            errorMessage: 'Échec de la validation du partenaire',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.partnerId),
        }
    );
};

/**
 * Hook to reject a pending partner
 */
export const useRejectPartner = (options?: {
    onSuccess?: (data: ApiSuccessResponse, partnerId: number) => void;
}) => {
    return useMutation(
        async ({ partnerId, data }: { partnerId: number; data: PartnerRejectionRequest }) =>
            advApi.partners.reject(partnerId, data),
        {
            successMessage: 'Partenaire rejeté',
            errorMessage: 'Échec du rejet du partenaire',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.partnerId),
        }
    );
};

// ==================== Credit Management Actions ====================

/**
 * Hook to update partner credit limit
 */
export const useUpdateCreditLimit = (options?: {
    onSuccess?: (data: ApiSuccessResponse, partnerId: number) => void;
}) => {
    return useMutation(
        async ({ partnerId, data }: { partnerId: number; data: CreditLimitUpdateRequest }) =>
            advApi.credit.updateLimit(partnerId, data),
        {
            onSuccess: (data, variables) => {
                // Check if supervisor approval required
                if (data.message?.includes('supervisor')) {
                    toast.success('Demande envoyée pour approbation du superviseur');
                } else {
                    toast.success('Plafond de crédit mis à jour');
                }
                options?.onSuccess?.(data, variables.partnerId);
            },
            errorMessage: 'Échec de la mise à jour du plafond de crédit',
        }
    );
};

/**
 * Hook to block a partner
 */
export const useBlockPartner = (options?: {
    onSuccess?: (data: ApiSuccessResponse, partnerId: number) => void;
}) => {
    return useMutation(
        async ({ partnerId, data }: { partnerId: number; data: PartnerBlockRequest }) =>
            advApi.credit.block(partnerId, data),
        {
            successMessage: 'Partenaire bloqué avec succès',
            errorMessage: 'Échec du blocage du partenaire',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.partnerId),
        }
    );
};

/**
 * Hook to unblock a partner
 */
export const useUnblockPartner = (options?: {
    onSuccess?: (data: ApiSuccessResponse, partnerId: number) => void;
}) => {
    return useMutation(
        async (partnerId: number) => advApi.credit.unblock(partnerId),
        {
            successMessage: 'Partenaire débloqué avec succès',
            errorMessage: 'Échec du déblocage du partenaire',
            onSuccess: (data, partnerId) => options?.onSuccess?.(data, partnerId),
        }
    );
};

// ==================== BC Validation Actions ====================

/**
 * Hook to approve a BC
 */
export const useApproveBC = (options?: {
    onSuccess?: (data: ApiSuccessResponse, bcId: number) => void;
}) => {
    return useMutation(
        async ({ bcId, data }: { bcId: number; data?: BCApprovalRequest }) =>
            advApi.bc.approve(bcId, data),
        {
            successMessage: 'BC validé avec succès',
            errorMessage: 'Échec de la validation du BC',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.bcId),
        }
    );
};

/**
 * Hook to reject a BC
 */
export const useRejectBC = (options?: {
    onSuccess?: (data: ApiSuccessResponse, bcId: number) => void;
}) => {
    return useMutation(
        async ({ bcId, data }: { bcId: number; data: BCRejectionRequest }) =>
            advApi.bc.reject(bcId, data),
        {
            successMessage: 'BC rejeté',
            errorMessage: 'Échec du rejet du BC',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.bcId),
        }
    );
};

/**
 * Hook to put BC on hold
 */
export const useHoldBC = (options?: {
    onSuccess?: (data: ApiSuccessResponse, bcId: number) => void;
}) => {
    return useMutation(
        async ({ bcId, data }: { bcId: number; data: BCHoldRequest }) =>
            advApi.bc.hold(bcId, data),
        {
            successMessage: 'BC mis en attente',
            errorMessage: 'Échec de la mise en attente du BC',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.bcId),
        }
    );
};

/**
 * Hook to request additional information for BC
 */
export const useRequestInfo = (options?: {
    onSuccess?: (data: ApiSuccessResponse, bcId: number) => void;
}) => {
    return useMutation(
        async ({ bcId, data }: { bcId: number; data: BCRequestInfoRequest }) =>
            advApi.bc.requestInfo(bcId, data),
        {
            successMessage: 'Demande d\'information envoyée',
            errorMessage: 'Échec de l\'envoi de la demande',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.bcId),
        }
    );
};

/**
 * Hook to batch approve multiple BCs
 */
export const useBatchApproveBC = (options?: {
    onSuccess?: (data: ApiSuccessResponse, bcIds: number[]) => void;
}) => {
    return useMutation(
        async (data: BCBatchApprovalRequest) => advApi.bc.batchApprove(data),
        {
            onSuccess: (data, variables) => {
                if (data.message?.includes('Failed')) {
                    toast.error(data.message);
                } else {
                    toast.success(data.message || 'BCs validés avec succès');
                }
                options?.onSuccess?.(data, variables.bc_ids);
            },
            errorMessage: 'Échec de la validation par lot',
        }

    );
};

// ==================== Derogation Actions ====================

/**
 * Hook to request a credit derogation for BC
 */
export const useRequestDerogation = (options?: {
    onSuccess?: (data: any, bcId: number) => void;
}) => {
    return useMutation(
        async ({ bcId, data }: { bcId: number; data: DerogationRequest }) =>
            advApi.derogations.request(bcId, data),
        {
            successMessage: 'Demande de dérogation soumise avec succès',
            errorMessage: 'Échec de la soumission de la demande',
            onSuccess: (data, variables) => options?.onSuccess?.(data, variables.bcId),
        }
    );
};

/**
 * Hook to approve a derogation (Chef ADV only)
 */
export const useApproveDerogation = (options?: {
    onSuccess?: (data: ApiSuccessResponse, derogationId: number) => void;
}) => {
    return useMutation(
        async ({ derogationId, data }: { derogationId: number; data?: DerogationApprovalRequest }) =>
            advApi.derogations.approve(derogationId, data),
        {
            onSuccess: (data, variables) => {
                if (data.message?.includes('BC approved')) {
                    toast.success('Dérogation approuvée et BC validé');
                } else {
                    toast.success('Dérogation approuvée');
                }
                options?.onSuccess?.(data, variables.derogationId);
            },
            errorMessage: 'Échec de l\'approbation de la dérogation',
        }
    );
};

/**
 * Hook to reject a derogation (Chef ADV only)
 */
export const useRejectDerogation = (options?: {
    onSuccess?: (data: ApiSuccessResponse, derogationId: number) => void;
}) => {
    return useMutation(
        async ({ derogationId, data }: { derogationId: number; data: DerogationRejectionRequest }) =>
            advApi.derogations.reject(derogationId, data),
        {
            onSuccess: (data, variables) => {
                if (data.message?.includes('BC rejected')) {
                    toast.success('Dérogation rejetée et BC rejeté');
                } else {
                    toast.success('Dérogation rejetée');
                }
                options?.onSuccess?.(data, variables.derogationId);
            },
            errorMessage: 'Échec du rejet de la dérogation',
        }
    );
};
