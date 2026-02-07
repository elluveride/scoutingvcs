import React, { createContext, useContext, useState, useEffect } from 'react';

type Alliance = 'blue' | 'red';

interface AllianceContextType {
  alliance: Alliance;
  setAlliance: (alliance: Alliance) => void;
}

const AllianceContext = createContext<AllianceContextType | undefined>(undefined);

export const AllianceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alliance, setAlliance] = useState<Alliance>(() => {
    return (localStorage.getItem('alliance') as Alliance) || 'blue';
  });

  useEffect(() => {
    localStorage.setItem('alliance', alliance);
    // Apply alliance class to document root for CSS theming
    document.documentElement.classList.remove('alliance-red', 'alliance-blue');
    document.documentElement.classList.add(`alliance-${alliance}`);
  }, [alliance]);

  return (
    <AllianceContext.Provider value={{ alliance, setAlliance }}>
      {children}
    </AllianceContext.Provider>
  );
};

export const useAlliance = () => {
  const context = useContext(AllianceContext);
  if (context === undefined) {
    throw new Error('useAlliance must be used within an AllianceProvider');
  }
  return context;
};
