import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface WildcardDenyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    scopeLabel?: string;
}

export function WildcardDenyDialog({ open, onOpenChange, onConfirm, scopeLabel }: WildcardDenyDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Confirmation requise
                    </DialogTitle>
                    <DialogDescription>
                        Vous êtes sur le point de créer une règle <strong>deny wildcard</strong>{' '}
                        {scopeLabel ? `pour ${scopeLabel}` : ''}. Cela masquera <strong>toutes</strong> les lignes
                        de ce type de modèle pour la cible choisie.
                        <br />
                        <br />
                        Les règles <code>allow</code> spécifiques sur des IDs concrets continueront de fonctionner en
                        exception.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuler
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        Confirmer le deny wildcard
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
