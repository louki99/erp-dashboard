import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileUploadProps {
    value?: File | File[] | null;
    onChange: (files: File | File[] | null) => void;
    accept?: string;
    multiple?: boolean;
    maxSize?: number; // in MB
    maxFiles?: number;
    showPreview?: boolean;
    disabled?: boolean;
    className?: string;
    label?: string;
    helperText?: string;
    error?: string;
    currentImages?: Array<{ id?: number; url: string; name?: string }>;
    onRemoveCurrentImage?: (id: number) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    value,
    onChange,
    accept = 'image/*',
    multiple = false,
    maxSize = 2, // 2MB default
    maxFiles = 10,
    showPreview = true,
    disabled = false,
    className,
    label,
    helperText,
    error,
    currentImages = [],
    onRemoveCurrentImage,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [previews, setPreviews] = useState<Array<{ file: File; preview: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convert value to array for consistent handling
    const files = value ? (Array.isArray(value) ? value : [value]) : [];

    // Generate previews when files change
    React.useEffect(() => {
        if (files.length === 0) {
            setPreviews([]);
            return;
        }

        const newPreviews: Array<{ file: File; preview: string }> = [];
        
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    newPreviews.push({ file, preview: reader.result as string });
                    if (newPreviews.length === files.length) {
                        setPreviews(newPreviews);
                    }
                };
                reader.readAsDataURL(file);
            } else {
                newPreviews.push({ file, preview: '' });
            }
        });

        return () => {
            previews.forEach(p => {
                if (p.preview) URL.revokeObjectURL(p.preview);
            });
        };
    }, [value]);

    const validateFile = (file: File): string | null => {
        // Check file size
        if (maxSize && file.size > maxSize * 1024 * 1024) {
            return `Le fichier ${file.name} dépasse la taille maximale de ${maxSize}MB`;
        }

        // Check file type
        if (accept && accept !== '*') {
            const acceptedTypes = accept.split(',').map(t => t.trim());
            const fileType = file.type;
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
            
            const isAccepted = acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return fileExtension === type.toLowerCase();
                }
                if (type.endsWith('/*')) {
                    return fileType.startsWith(type.replace('/*', ''));
                }
                return fileType === type;
            });

            if (!isAccepted) {
                return `Le fichier ${file.name} n'est pas un type accepté`;
            }
        }

        return null;
    };

    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles || newFiles.length === 0) return;

        const fileArray = Array.from(newFiles);
        const errors: string[] = [];

        // Validate each file
        fileArray.forEach(file => {
            const error = validateFile(file);
            if (error) errors.push(error);
        });

        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        // Check max files limit
        if (multiple && maxFiles) {
            const totalFiles = files.length + fileArray.length + currentImages.length;
            if (totalFiles > maxFiles) {
                alert(`Vous ne pouvez télécharger que ${maxFiles} fichiers maximum`);
                return;
            }
        }

        if (multiple) {
            onChange([...files, ...fileArray]);
        } else {
            onChange(fileArray[0]);
        }
    }, [files, multiple, maxFiles, currentImages, onChange]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const droppedFiles = e.dataTransfer.files;
        handleFiles(droppedFiles);
    }, [disabled, handleFiles]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
    };

    const handleRemoveFile = (index: number) => {
        if (multiple) {
            const newFiles = files.filter((_, i) => i !== index);
            onChange(newFiles.length > 0 ? newFiles : null);
        } else {
            onChange(null);
        }
    };

    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const isImage = (file: File) => file.type.startsWith('image/');

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}

            {/* Upload Area */}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer',
                    isDragging && !disabled && 'border-blue-500 bg-blue-50',
                    !isDragging && !disabled && 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                    disabled && 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60',
                    error && 'border-red-300 bg-red-50'
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={handleFileInputChange}
                    disabled={disabled}
                    className="hidden"
                />

                <div className="flex flex-col items-center justify-center text-center">
                    <Upload className={cn(
                        'w-12 h-12 mb-3',
                        isDragging ? 'text-blue-500' : 'text-gray-400'
                    )} />
                    <p className="text-sm font-medium text-gray-700 mb-1">
                        {isDragging ? 'Déposez les fichiers ici' : 'Cliquez pour télécharger ou glissez-déposez'}
                    </p>
                    <p className="text-xs text-gray-500">
                        {accept === 'image/*' ? 'PNG, JPG, JPEG, WEBP' : accept.replace(/\*/g, 'tous types')}
                        {maxSize && ` (max ${maxSize}MB)`}
                    </p>
                    {multiple && maxFiles && (
                        <p className="text-xs text-gray-500 mt-1">
                            Maximum {maxFiles} fichiers
                        </p>
                    )}
                </div>
            </div>

            {/* Helper Text */}
            {helperText && !error && (
                <p className="mt-2 text-xs text-gray-500">{helperText}</p>
            )}

            {/* Error Message */}
            {error && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
            )}

            {/* Current Images (from server) */}
            {showPreview && currentImages.length > 0 && (
                <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Images actuelles</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {currentImages.map((image, index) => (
                            <div key={image.id || index} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                    <img
                                        src={image.url}
                                        alt={image.name || `Image ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {onRemoveCurrentImage && image.id && (
                                    <button
                                        type="button"
                                        onClick={() => onRemoveCurrentImage(image.id!)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <CheckCircle className="w-3 h-3 inline mr-1" />
                                    Enregistré
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* File Previews (newly selected) */}
            {showPreview && previews.length > 0 && (
                <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        {multiple ? `${previews.length} fichier(s) sélectionné(s)` : 'Fichier sélectionné'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {previews.map((item, index) => (
                            <div key={index} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden border-2 border-blue-500 bg-gray-100">
                                    {isImage(item.file) && item.preview ? (
                                        <img
                                            src={item.preview}
                                            alt={item.file.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                            <File className="w-8 h-8 text-gray-400 mb-1" />
                                            <p className="text-xs text-gray-600 text-center truncate w-full">
                                                {item.file.name}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    disabled={disabled}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white text-xs p-2 rounded-b-lg">
                                    <p className="truncate font-medium">{item.file.name}</p>
                                    <p className="text-gray-300">{formatFileSize(item.file.size)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
