export interface NiagaDesktopBridge {
  isElectron?: boolean;
  printPage?: () => Promise<{ success: boolean; reason?: string }>;
  savePdf?: (defaultFileName: string) => Promise<{ canceled: boolean; filePath?: string }>;
  saveFile?: (payload: {
    defaultFileName: string;
    content: string;
    filterName?: string;
    extensions?: string[];
  }) => Promise<{ canceled: boolean; filePath?: string }>;
}

function getDesktopBridge(): NiagaDesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { niagaDesktop?: NiagaDesktopBridge }).niagaDesktop;
}

export function isElectronDesktop(): boolean {
  const bridge = getDesktopBridge();
  if (bridge?.isElectron) return true;
  return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
}

export async function saveTextFileDesktop(
  defaultFileName: string,
  content: string,
  filterName = 'File Backup JSON',
  extensions: string[] = ['json']
): Promise<{ handled: boolean; canceled?: boolean; filePath?: string }> {
  const bridge = getDesktopBridge();
  if (!bridge?.saveFile) {
    return { handled: false };
  }
  const res = await bridge.saveFile({
    defaultFileName,
    content,
    filterName,
    extensions,
  });
  return {
    handled: true,
    canceled: res.canceled,
    filePath: res.filePath,
  };
}

export async function printCurrentPage(): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge?.printPage) {
    try {
      await bridge.printPage();
      return;
    } catch {
      // Fallback to browser window.print() below
    }
  }
  window.print();
}

export async function savePageAsPdf(
  defaultFileName: string,
  onNotify?: (message: string) => void
): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge?.savePdf) {
    try {
      const res = await bridge.savePdf(defaultFileName);
      if (!res.canceled && res.filePath) {
        onNotify?.(`PDF berhasil disimpan: ${res.filePath}`);
      }
      return;
    } catch {
      onNotify?.('Gagal menyimpan PDF otomatis, membuka dialog cetak...');
    }
  }
  window.print();
}
