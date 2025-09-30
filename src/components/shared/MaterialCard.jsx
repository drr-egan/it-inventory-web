import React from 'react';

const MaterialCard = ({ children, elevation = 1, className = '', ...props }) => {
    return (
        <div className={`mat-card mat-elevation-${elevation} p-6 ${className}`} {...props}>
            {children}
        </div>
    );
};

export default MaterialCard;