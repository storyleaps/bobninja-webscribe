// Chrome Extension API type declarations
// This provides minimal typing for the chrome APIs used in this popup

declare namespace chrome {
  namespace extension {
    function isAllowedIncognitoAccess(callback: (isAllowed: boolean) => void): void;
  }

  namespace tabs {
    function create(createProperties: { url: string; active?: boolean }): Promise<{ id: number }>;
  }

  namespace runtime {
    const id: string;
    function getURL(path: string): string;
  }

  namespace storage {
    namespace local {
      function set(items: Record<string, unknown>): Promise<void>;
      function get(keys: string | string[]): Promise<Record<string, unknown>>;
    }
  }

  namespace windows {
    function create(createData: {
      url?: string;
      type?: string;
      width?: number;
      height?: number;
      left?: number;
      top?: number;
      focused?: boolean;
    }): Promise<{ id: number }>;
  }
}
