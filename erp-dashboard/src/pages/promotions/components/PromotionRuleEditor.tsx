import { useState } from 'react';
import Split from 'react-split';
import { PromotionLinesGrid } from './PromotionLinesGrid';
import { PromotionLineDetailsGrid } from './PromotionLineDetailsGrid';

export const PromotionRuleEditor = () => {
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

    return (
        <div className="h-[600px] bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            <Split
                sizes={[60, 40]}
                minSize={100}
                expandToMin={false}
                gutterSize={4}
                gutterAlign="center"
                snapOffset={30}
                dragInterval={1}
                direction="vertical"
                cursor="row-resize"
                className="flex-1 flex flex-col h-full"
            >
                <div className="flex flex-col overflow-hidden">
                    <PromotionLinesGrid onLineSelected={setSelectedLineIndex} />
                </div>

                <div className="flex flex-col overflow-hidden border-t border-gray-200">
                    <PromotionLineDetailsGrid lineIndex={selectedLineIndex} />
                </div>
            </Split>
        </div>
    );
};
