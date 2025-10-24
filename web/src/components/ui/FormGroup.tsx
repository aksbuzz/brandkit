import type { ReactNode } from 'react';

type FormGroupProps = {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  labelInfo?: string;
};

export const FormGroup = ({ label, children, htmlFor, labelInfo }: FormGroupProps) => {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {labelInfo && <span className="text-gray-500 ml-1">{labelInfo}</span>}
      </label>
      {children}
    </div>
  );
};
