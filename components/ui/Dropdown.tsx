'use client';

import { useEffect, useRef } from 'react';

interface DropdownOption<T> {
  key?: string;
  label: string;
  value: T;
}

export interface DropdownProps<T> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  isOpen,
  onToggle      
}: DropdownProps<T>) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
  
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
  
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-1 text-white bg-transparent px-2 py-1 text-sm focus:outline-none hover:text-orange-400 transition-colors cursor-pointer"
      >
        <span>{value}</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-2 w-24 rounded-lg bg-[#131722] shadow-lg border border-gray-800 overflow-hidden z-50"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;

            return (
              <button
                key={opt.key ? opt.key : String(opt.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                }}
                className={`
                  w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors
                  ${isActive ? 'text-white' : 'text-gray-400'}
                  hover:text-white hover:bg-[#1e222d]
                `}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
