/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = exports.SING_MODE = void 0;
const cp = require("child_process");
const os = require("os");
const vscode = require("vscode");
const language_client_1 = require("./language_client");
/*
* Language programmatic features start
*/
exports.SING_MODE = { language: 'singlang', scheme: 'file' };
let language_client;
function registerLanguageFeatures(ctx) {
    //ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => watchLanguageServerConfiguration(e)));
    //const config = parseLanguageServerConfig();
    language_client = new language_client_1.LanguageClient(ctx);
    ctx.subscriptions.push(language_client);
    vscode.languages.registerCompletionItemProvider(exports.SING_MODE, language_client, '.', '"', "/", ":");
    vscode.languages.registerSignatureHelpProvider(exports.SING_MODE, language_client, '(', ',');
    vscode.languages.registerDefinitionProvider(exports.SING_MODE, language_client);
    vscode.languages.registerDocumentSymbolProvider(exports.SING_MODE, language_client);
}
function activate(context) {
    // update command
    context.subscriptions.push(vscode.commands.registerCommand('extension.vscode-sing.update', () => {
        // The code you place here will be executed every time your command is executed
        var updater_path = "";
        if (os.platform() == 'win32') {
            updater_path = "sdk/win/bin/updater";
        }
        else {
            updater_path = "sdk/linux/bin/updater";
        }
        updater_path = context.asAbsolutePath(updater_path);
        var work_folders = vscode.workspace.workspaceFolders;
        if (work_folders != null) {
            cp.execFile(updater_path, [work_folders[0].uri.fsPath, context.asAbsolutePath("sdk")], (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showInformationMessage("Update: " + err);
                }
                else {
                    vscode.window.showInformationMessage("Update: " + stdout);
                }
            });
        }
    }));
    registerLanguageFeatures(context);
}
exports.activate = activate;
function deactivate() {
    // nothing to do
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map