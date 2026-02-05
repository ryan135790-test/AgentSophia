import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';

interface SophiaAnswerOptionsProps {
  options: string[];
  onSelectOption: (option: string) => void;
  isLoading?: boolean;
  multiSelect?: boolean;
  multiSelectLabel?: string;
}

export function SophiaAnswerOptions({ 
  options, 
  onSelectOption, 
  isLoading,
  multiSelect = false,
  multiSelectLabel = "Continue with selected"
}: SophiaAnswerOptionsProps) {
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedOptions(new Set());
  }, [options, multiSelect]);

  if (!options.length) return null;

  const handleOptionClick = (option: string) => {
    if (multiSelect) {
      const newSelected = new Set(selectedOptions);
      
      if (option === 'All of the above') {
        if (newSelected.has(option)) {
          newSelected.delete(option);
        } else {
          newSelected.clear();
          newSelected.add(option);
        }
      } else {
        newSelected.delete('All of the above');
        
        if (newSelected.has(option)) {
          newSelected.delete(option);
        } else {
          newSelected.add(option);
        }
      }
      setSelectedOptions(newSelected);
    } else {
      onSelectOption(option);
    }
  };

  const handleContinue = () => {
    if (selectedOptions.size > 0) {
      const selected = Array.from(selectedOptions).join(', ');
      onSelectOption(selected);
      setSelectedOptions(new Set());
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {multiSelect && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2">
          <Check className="h-3 w-3" />
          Select options, then continue
        </p>
      )}
      
      <div className="flex flex-wrap gap-2">
        {options.map((option, idx) => {
          const isSelected = selectedOptions.has(option);
          
          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                ${multiSelect && isSelected 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-500 hover:text-white hover:shadow-sm border border-slate-200 dark:border-slate-700 hover:border-transparent'
                }`}
              data-testid={`answer-option-${idx}`}
            >
              {multiSelect && isSelected && <Check className="h-3 w-3" />}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      
      {multiSelect && selectedOptions.size > 0 && (
        <Button
          onClick={handleContinue}
          disabled={isLoading}
          size="sm"
          className="mt-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-4"
          data-testid="multi-select-continue"
        >
          {multiSelectLabel}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
            {selectedOptions.size}
          </span>
        </Button>
      )}
    </div>
  );
}
