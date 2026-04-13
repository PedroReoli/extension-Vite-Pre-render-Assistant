import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface DetectionResult {
  isVite: boolean;
  rootPath: string | undefined;
}

/**
 * Verifica se o workspace atual contém um projeto Vite.
 * Valida presença de package.json e dependência do Vite.
 */
export function detectViteProject(): DetectionResult {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return { isVite: false, rootPath: undefined };
  }

  const rootPath = folders[0].uri.fsPath;
  const packageJsonPath = path.join(rootPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { isVite: false, rootPath };
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);

    const allDeps: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const isVite = 'vite' in allDeps;
    return { isVite, rootPath };
  } catch {
    return { isVite: false, rootPath };
  }
}
