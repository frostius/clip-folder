const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function activate(context) {
  let disposable = vscode.commands.registerCommand('clipFolder.copyFiles', async (uri) => {
    if (!uri || !uri.fsPath) {
      vscode.window.showErrorMessage("No folder selected.");
      return;
    }

    const folderPath = uri.fsPath;
    const config = vscode.workspace.getConfiguration('clipFolder');
    const includeGlobs = config.get('includeGlobs') || ['**/*'];
    const excludeGlobs = config.get('excludeGlobs') || [];

    let matchedFiles = [];

    for (const pattern of includeGlobs) {
      const files = glob.sync(pattern, {
        cwd: folderPath,
        absolute: true,
        ignore: excludeGlobs
      });
      matchedFiles.push(...files);
    }

    matchedFiles = [...new Set(matchedFiles)].filter(f => fs.statSync(f).isFile());

    if (matchedFiles.length === 0) {
      vscode.window.showInformationMessage("No matching files found.");
      return;
    }

    let combined = '';
    for (const filePath of matchedFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      combined += `----- file:${fileName} ---\n${content}\n\n`;
    }

    await vscode.env.clipboard.writeText(combined);
    vscode.window.showInformationMessage(`Copied ${matchedFiles.length} files to clipboard.`);
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
