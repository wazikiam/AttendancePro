declare global {
  interface Window {
    electronAPI: {
      // Window control
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isWindowMaximized: () => Promise<boolean>;
      
      // App info
      getAppVersion: () => Promise<string>;
      getAppPath: (name: string) => Promise<string>;
      
      // File operations
      selectFile: (options: any) => Promise<any>;
      saveFile: (options: any) => Promise<any>;
      
      // Menu actions
      onMenuAction: (callback: (action: string) => void) => () => void;
      onTrayAction: (callback: (action: string) => void) => () => void;
      
      // Remove listeners
      removeAllListeners: (channel: string) => void;
    };
    
    nodeAPI: {
      platform: string;
      versions: NodeJS.ProcessVersions;
    };
    
    env: {
      isDev: boolean;
      isProd: boolean;
    };
  }
}

export {};