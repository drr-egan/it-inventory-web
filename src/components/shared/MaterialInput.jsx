import React, { forwardRef } from 'react';

const MaterialInput = forwardRef(({ label, type = 'text', value, onChange, placeholder = ' ', ...props }, ref) => {
    return (
        <div className="mat-input">
            <input
                ref={ref}
                type={type}
                value={value ?? ''}
                onChange={onChange}
                placeholder={placeholder}
                {...props}
            />
            <label>{label}</label>
        </div>
    );
});

MaterialInput.displayName = 'MaterialInput';

export default MaterialInput;