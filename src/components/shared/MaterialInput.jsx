import React, { forwardRef } from 'react';

const MaterialInput = forwardRef(({ label, type = 'text', value, onChange, placeholder = ' ', children, ...props }, ref) => {
    return (
        <div className="mat-input" style={{ position: 'relative' }}>
            <input
                ref={ref}
                type={type}
                value={value ?? ''}
                onChange={onChange}
                placeholder={placeholder}
                {...props}
            />
            <label>{label}</label>
            {children}
        </div>
    );
});

MaterialInput.displayName = 'MaterialInput';

export default MaterialInput;