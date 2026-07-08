import { useState } from 'react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DataRuleFilters,
    DataRuleForm,
    DataRulesTable,
    ProfileVisibilityEditor,
    WildcardDenyDialog,
} from '@/components/data-rules';
import {
    useCreateDataRule,
    useDataRules,
    useDeleteDataRule,
    useUpdateDataRule,
    isWildcardDenyConfirmationError,
} from '@/hooks/dataRules/useDataRules';
import type {
    CreateDataRulePayload,
    DataRule,
    DataRuleFilters as Filters,
    UpdateDataRulePayload,
} from '@/types/dataRules.types';
import { Plus, Shield, AlertTriangle } from 'lucide-react';
import { getActionLabel, getModelTypeLabel, getScopeTypeLabel, MODEL_TYPE_OPTIONS } from '@/lib/dataRules';
import { isAxiosError } from 'axios';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Une erreur est survenue.';
}

const DEFAULT_FILTERS: Filters = { per_page: 50, page: 1 };

// Demo items for the ProfileVisibilityEditor showcase.
// In production this list would come from the relevant model API (e.g. ProductPage list).
const DEMO_PRODUCT_PAGES = [
    { id: 5, label: 'Catalogue Standard' },
    { id: 8, label: 'Catalogue Premium' },
    { id: 11, label: 'Promotions Été' },
    { id: 15, label: 'Nouveautés' },
    { id: 20, label: 'Destockage' },
    { id: 22, label: 'Exclusivité B2B' },
];

export function DataRulesPage() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const { data, isLoading } = useDataRules(filters);

    const [editingRule, setEditingRule] = useState<DataRule | null | undefined>(undefined);
    const [ruleToDelete, setRuleToDelete] = useState<DataRule | null>(null);

    const [pendingPayload, setPendingPayload] = useState<CreateDataRulePayload | UpdateDataRulePayload | null>(null);
    const [showWildcardDialog, setShowWildcardDialog] = useState(false);

    const [profileId, setProfileId] = useState<string>('8');

    const createRule = useCreateDataRule();
    const updateRule = useUpdateDataRule(editingRule?.id ?? 0);
    const deleteRule = useDeleteDataRule();

    const handleFormSubmit = async (payload: CreateDataRulePayload | UpdateDataRulePayload) => {
        try {
            if (editingRule) {
                await updateRule.mutateAsync(payload as UpdateDataRulePayload);
                toast.success('Règle mise à jour.');
            } else {
                await createRule.mutateAsync(payload as CreateDataRulePayload);
                toast.success('Règle créée.');
            }
            setEditingRule(undefined);
        } catch (error) {
            if (isWildcardDenyConfirmationError(error)) {
                setPendingPayload(payload);
                setShowWildcardDialog(true);
                return;
            }
            toast.error(getErrorMessage(error));
        }
    };

    const handleConfirmWildcardDeny = async () => {
        if (!pendingPayload) return;
        const confirmedPayload = { ...pendingPayload, confirm_wildcard_deny: true };
        try {
            if (editingRule) {
                await updateRule.mutateAsync(confirmedPayload as UpdateDataRulePayload);
                toast.success('Règle mise à jour.');
            } else {
                await createRule.mutateAsync(confirmedPayload as CreateDataRulePayload);
                toast.success('Règle créée.');
            }
            setPendingPayload(null);
            setShowWildcardDialog(false);
            setEditingRule(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!ruleToDelete) return;
        try {
            await deleteRule.mutateAsync(ruleToDelete.id);
            toast.success('Règle supprimée.');
            setRuleToDelete(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handlePageChange = (page: number) => {
        setFilters((prev) => ({ ...prev, page }));
    };

    return (
        <MasterLayout
            leftContent={<div className="h-full border-r border-gray-100 bg-white p-4" />}
            mainContent={
                <div className="h-full overflow-y-auto bg-gray-50/50 p-4 md:p-6">
                    <div className="mx-auto max-w-7xl space-y-6">
                        {/* Header */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                    <Shield className="h-6 w-6 text-primary" />
                                    Gouvernance des données
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Matrice de visibilité dynamique (data_rules)
                                </p>
                            </div>
                            <Button onClick={() => setEditingRule(null)}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Nouvelle règle
                            </Button>
                        </div>

                        {/* Form dialog */}
                        <Dialog open={editingRule !== undefined} onOpenChange={(open) => !open && setEditingRule(undefined)}>
                            <DialogContent className="max-w-2xl">
                                <DataRuleForm
                                    key={editingRule ? `edit-${editingRule.id}` : 'create'}
                                    rule={editingRule ?? null}
                                    onSubmit={handleFormSubmit}
                                    onCancel={() => setEditingRule(undefined)}
                                    loading={createRule.isPending || updateRule.isPending}
                                />
                            </DialogContent>
                        </Dialog>

                        {/* Delete confirmation dialog */}
                        <Dialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-destructive">
                                        <AlertTriangle className="h-5 w-5" />
                                        Supprimer la règle ?
                                    </DialogTitle>
                                    <DialogDescription>
                                        {ruleToDelete && (
                                            <>
                                                Vous allez supprimer la règle{' '}
                                                <Badge variant="outline">#{ruleToDelete.id}</Badge> :{' '}
                                                <strong>{getActionLabel(ruleToDelete.action)}</strong>{' '}
                                                {getModelTypeLabel(ruleToDelete.model_type)} pour{' '}
                                                {getScopeTypeLabel(ruleToDelete.scope_type)} {ruleToDelete.scope_value}.
                                                <br />
                                                <br />
                                                Cette action est irréversible.
                                            </>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setRuleToDelete(null)}>
                                        Annuler
                                    </Button>
                                    <Button variant="destructive" onClick={handleDelete} disabled={deleteRule.isPending}>
                                        Supprimer
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Wildcard deny confirmation */}
                        <WildcardDenyDialog
                            open={showWildcardDialog}
                            onOpenChange={(open) => {
                                if (!open) {
                                    setShowWildcardDialog(false);
                                    setPendingPayload(null);
                                }
                            }}
                            onConfirm={handleConfirmWildcardDeny}
                            scopeLabel={
                                pendingPayload
                                    ? `${getScopeTypeLabel(pendingPayload.scope_type!)} ${pendingPayload.scope_value}`
                                    : undefined
                            }
                        />

                        {/* Filters */}
                        <DataRuleFilters filters={filters} onChange={setFilters} />

                        {/* Table */}
                        <DataRulesTable
                            response={data}
                            loading={isLoading}
                            onEdit={setEditingRule}
                            onDelete={setRuleToDelete}
                            onPageChange={handlePageChange}
                        />

                        {/* Profile visibility editor showcase */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Visibilité par profil</CardTitle>
                                <CardDescription>
                                    Exemple d'éditeur bulk-replace pour un profil donné (Recipe B du guide).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex max-w-xs items-center gap-2">
                                    <Label htmlFor="profile-id">Profil ID</Label>
                                    <Input
                                        id="profile-id"
                                        value={profileId}
                                        onChange={(e) => setProfileId(e.target.value)}
                                        placeholder="8"
                                    />
                                </div>
                                {profileId && (
                                    <ProfileVisibilityEditor
                                        profileId={Number(profileId) || profileId}
                                        modelType={MODEL_TYPE_OPTIONS[0].value}
                                        items={DEMO_PRODUCT_PAGES}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            }
        />
    );
}
