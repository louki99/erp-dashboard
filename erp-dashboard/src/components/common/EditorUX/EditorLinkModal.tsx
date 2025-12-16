import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Link, Image as ImageIcon } from 'lucide-react';

interface EditorLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { url: string; width?: string }) => void;
    type: 'link' | 'image';
    initialUrl?: string;
}

export const EditorLinkModal = ({
    isOpen,
    onClose,
    onSubmit,
    type,
    initialUrl = '',
}: EditorLinkModalProps) => {
    const [url, setUrl] = useState(initialUrl);
    const [width, setWidth] = useState('100%');

    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl);
            setWidth('100%');
        }
    }, [isOpen, initialUrl]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ url, width: type === 'image' ? width : undefined });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={type === 'link' ? 'Insert Link' : 'Insert Image'}
            size="sm"
        >
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL
                    </label>
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {type === 'link' ? (
                                <Link className="h-4 w-4 text-gray-400" />
                            ) : (
                                <ImageIcon className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                        <input
                            type="url"
                            className="focus:ring-sage-500 focus:border-sage-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                            placeholder={type === 'link' ? "https://example.com" : "https://example.com/image.png"}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                </div>

                {type === 'image' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Width
                        </label>
                        <select
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sage-500 focus:border-sage-500 sm:text-sm rounded-md border"
                        >
                            <option value="25%">Small (25%)</option>
                            <option value="50%">Medium (50%)</option>
                            <option value="75%">Large (75%)</option>
                            <option value="100%">Full Width (100%)</option>
                        </select>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="mr-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-sage-600 border border-transparent rounded-md hover:bg-sage-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500"
                    >
                        Insert
                    </button>
                </div>
            </form>
        </Modal>
    );
};
