import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  logoUrl: string;
}

export const LIGHT_LOGO = 'https://lh3.googleusercontent.com/pw/AP1GczPrmIk6FRTBXzwmsd1gkukuxksJGi2MSDbmA9vkfGShUosr189Bt2vR0_6x4fMD6gY4GmmKDqOtSHjybvp8v8RPhiNJmGU437bB38cc0hsMGpYDTEPAR2qanvgv6BxEbkMrDti8vdrdXPd2sfTn9LNr=w1756-h958-s-no-gm?authuser=0';
export const DARK_LOGO = 'https://lh3.googleusercontent.com/pw/AP1GczMXkjdytsl62qmRzarmeuNGpCKa6EtmoR1LgWlz0vjkCcadvsHVuLYKOr_BNRalxTMJOd09ljP1kpFjHxaO8CTCIbfcpJQEpC2s-At_lDgw2iEO5SFGT80kYt0knkS_vyz8NZQPg1s8MdqKwCLu4ZlK=w1756-h958-s-no-gm?authuser=0';

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  logoUrl: LIGHT_LOGO,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('barber_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('barber_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const logoUrl = isDarkMode ? DARK_LOGO : LIGHT_LOGO;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, logoUrl }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
