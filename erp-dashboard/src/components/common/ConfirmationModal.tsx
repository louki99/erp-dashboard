import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { AlertTriangle, X, GripHorizontal, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'sage';
    children?: React.ReactNode;
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    children,
    isLoading = false
}) => {
    const dragControls = useDragControls();
    const [size, setSize] = useState({ width: 448, height: 'auto' }); // 448px is max-w-md
    const modalRef = useRef<HTMLDivElement>(null);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = modalRef.current?.offsetWidth || 448;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(320, startWidth + (moveEvent.clientX - startX));
            // For height, we might want to keep it auto or allow resizing. 
            // Let's allow resizing but keep min height.
            // const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));

            setSize({
                width: newWidth,
                height: 'auto' // For now, let's keep height auto-growing with content, resizing width is most useful.
                // If user wants full resize, we can enable height too.
                // Let's enable both for "grabbable and resizable" request.
            });

            if (modalRef.current) {
                modalRef.current.style.width = `${newWidth}px`;
                // modalRef.current.style.height = `${newHeight}px`; 
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            ref={modalRef}
                            drag
                            dragControls={dragControls}
                            dragListener={false}
                            dragMomentum={false}
                            dragElastic={0}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
                            style={{ width: size.width }}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto relative"
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Drag Handle Area (Header) */}
                            <div
                                onPointerDown={(e) => dragControls.start(e)}
                                className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing z-10 flex justify-center"
                            >
                                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-2" />
                            </div>

                            <div className="p-6 overflow-y-auto mt-2">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-full shrink-0 ${variant === 'danger' ? 'bg-red-100 text-red-600' :
                                        variant === 'warning' ? 'bg-amber-100 text-amber-600' :
                                            variant === 'sage' ? 'bg-emerald-100 text-emerald-600' :
                                                'bg-blue-100 text-blue-600'
                                        }`}>
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                {title}
                                            </h3>
                                            <button
                                                onClick={onClose}
                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {description}
                                        </p>
                                        {children && (
                                            <div className="mt-4">
                                                {children}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>



                            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 shrink-0 relative">
                                <button
                                    onClick={onClose}
                                    disabled={isLoading}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        // onClose(); // Let parent handle closing
                                    }}
                                    disabled={isLoading}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm focus:ring-2 focus:ring-offset-2 transition-all flex items-center gap-2 ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' :
                                        variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' :
                                            variant === 'sage' ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' :
                                                'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                                        } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {confirmText}
                                </button>

                                {/* Resize Handle */}
                                <div
                                    onMouseDown={handleResize}
                                    className="absolute bottom-0 right-0 p-1 cursor-nwse-resize text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400"
                                >
                                    <GripHorizontal className="w-4 h-4 transform rotate-45" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
