const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// --- Normalize path slashes to forward slashes (for cross-platform consistency)
function toForwardSlash(p) {
  return p.replace(/\\/g, '/');
}

// --- Convert glob pattern to regular expression
// Supports only '*' (any characters) and '?' (single character)
function globToRegex(glob) {
  // Escape regex-sensitive characters
  const escaped = glob.replace(/[-[\]/{}()+.,\\^$|#\s]/g, '\\$&');
  // Replace glob wildcards with regex equivalents
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr);
}

// --- Filter a list of names using glob patterns
function filterByPatterns(names, patterns) {
  const regexes = patterns.map(globToRegex);
  return names.filter(name => regexes.some(rx => rx.test(name)));
}

// --- Extension activation entry point
function activate(context) {
  console.log("Clip Folder extension activated");

  // Register the command: clipFolder.copyFiles
  const disposable = vscode.commands.registerCommand('clipFolder.copyFiles', async (uri) => {
    try {
      // Ensure a folder was selected
      if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage("No folder selected.");
        return;
      }

      const folderPath = uri.fsPath;

      // Read user-defined glob patterns from settings
      const config = vscode.workspace.getConfiguration('clipFolder');
      const includeGlobs = config.get('includeGlobs') || ['*'];     // default: include all files
      const excludeGlobs = config.get('excludeGlobs') || [];        // default: exclude nothing

      // Read top-level entries in the folder
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      // Collect only files (no subfolders)
      const allFiles = entries
        .filter(e => e.isFile())
        .map(e => {
          const absPath = path.join(folderPath, e.name);
          const relPath = toForwardSlash(e.name); // normalize for matching
          return { relPath, absPath };
        });

      // Apply glob filtering
      const relPaths = allFiles.map(f => f.relPath);
      const included = filterByPatterns(relPaths, includeGlobs);
      const excluded = filterByPatterns(included, excludeGlobs);

      // Final list of matched files
      const matchedFiles = allFiles
        .filter(f => included.includes(f.relPath) && !excluded.includes(f.relPath))
        .map(f => f.absPath);

      // Handle case: no matching files
      if (matchedFiles.length === 0) {
        vscode.window.showInformationMessage("No matching files found.");
        return;
      }

      // Read and combine contents of matched files
      let combined = '';
      for (const filePath of matchedFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        combined += `----- file:${fileName} ---\n${content}\n\n`;
      }

      // Copy combined content to clipboard
      await vscode.env.clipboard.writeText(combined);
      vscode.window.showInformationMessage(`Copied ${matchedFiles.length} files to clipboard.`);
    } catch (err) {
      console.error("Error in clipFolder.copyFiles:", err);
      vscode.window.showErrorMessage("An error occurred: " + err.message);
    }
  });

  // Register the command with VS Code
  context.subscriptions.push(disposable);
}

// --- Extension deactivation (no cleanup needed here)
function deactivate() {}

module.exports = {
  activate,
  deactivate
};
