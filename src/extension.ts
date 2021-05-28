/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import cp = require('child_process');
import os = require('os');
import * as vscode from 'vscode';
import { LanguageClient } from './language_client';

/*
* Language programmatic features start
*/
export const SING_MODE: vscode.DocumentFilter = { language: 'singlang', scheme: 'file' };

let language_client: LanguageClient;

function registerLanguageFeatures(ctx: vscode.ExtensionContext)
{
   	//ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => watchLanguageServerConfiguration(e)));
	//const config = parseLanguageServerConfig();

	language_client = new LanguageClient(ctx);
	ctx.subscriptions.push(language_client);
	vscode.languages.registerCompletionItemProvider(SING_MODE, language_client, '.', '"', "/", ":");
	vscode.languages.registerSignatureHelpProvider(SING_MODE, language_client, '(', ',');
	vscode.languages.registerDefinitionProvider(SING_MODE, language_client);
	vscode.languages.registerDocumentSymbolProvider(SING_MODE, language_client);
}

export function activate(context: vscode.ExtensionContext) {

	// update command
	context.subscriptions.push(vscode.commands.registerCommand('extension.vscode-sing.update', () => {

		// The code you place here will be executed every time your command is executed
		var updater_path = "";
		if (os.platform() == 'win32') {
			updater_path = "sdk/win/bin/updater";
		} else {
			updater_path = "sdk/linux/bin/updater";
		}
		updater_path = context.asAbsolutePath(updater_path);
		var work_folders = vscode.workspace.workspaceFolders;
		if (work_folders != null) {
			cp.execFile(updater_path, [work_folders[0].uri.fsPath, context.asAbsolutePath("sdk")],
				(err, stdout, stderr) => {
					if (err) {
						vscode.window.showInformationMessage("Update: " + err);
					} else {
						vscode.window.showInformationMessage("Update: " + stdout);
					}
			  	}
			);
		}
	}));

	registerLanguageFeatures(context);
}

export function deactivate() {
	// nothing to do
}
