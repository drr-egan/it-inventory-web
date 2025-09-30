import React from 'react';

const MaterialButton = ({ children, variant = 'contained', color = 'primary', onClick, disabled, className = '', ...props }) => {
    const baseClasses = 'mat-ripple inline-flex items-center justify-center px-6 py-3 font-medium text-sm rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantClasses = {
        contained: {
            primary: 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 focus:ring-blue-500 mat-elevation-2',
            secondary: 'bg-gray-600 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-800 focus:ring-gray-500 mat-elevation-2',
            success: 'bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-800 focus:ring-green-500 mat-elevation-2',
            error: 'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500 mat-elevation-2'
        },
        outlined: {
            primary: 'border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:ring-blue-500',
            secondary: 'border border-gray-600 dark:border-gray-500 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-500',
            success: 'border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500',
            error: 'border border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500'
        },
        text: {
            primary: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:ring-blue-500',
            secondary: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-500',
            success: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 focus:ring-green-500',
            error: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500'
        }
    };

    const buttonClasses = `${baseClasses} ${variantClasses[variant][color]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

    return (
        <button
            className={buttonClasses}
            onClick={onClick}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
};

export default MaterialButton;