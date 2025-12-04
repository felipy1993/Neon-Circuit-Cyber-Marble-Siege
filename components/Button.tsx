import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...props }) => {
  const baseStyle = "font-display text-lg px-8 py-3 uppercase tracking-widest transition-all duration-200 clip-path-slant focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 flex items-center justify-center";
  
  // Note: For advanced theming, we rely on the parent to style, or these defaults which match the Classic theme perfectly.
  // The 'primary' variant uses cyan, 'secondary' uses magenta.
  const variants = {
    primary: "bg-[#00f0ff] text-black hover:bg-[#fff] hover:shadow-[0_0_20px_#00f0ff]",
    secondary: "bg-transparent border-2 border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-black hover:shadow-[0_0_20px_#ff00ff]",
    danger: "bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_20px_#ff0000]"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;