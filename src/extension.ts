/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import cp = require('child_process');
import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { MockDebugSession } from './mockDebug';
import * as Net from 'net';
import { SingCompletionItemProvider } from './completion';

/*
 * The compile time flag 'runMode' controls how the debug adapter is run.
 * Please note: the test suite only supports 'external' mode.
 */
const runMode: 'external' | 'server' | 'inline' = 'inline';

/*
* Language programmatic features start
*/

export const SING_MODE: vscode.DocumentFilter = { language: 'singlang', scheme: 'file' };
let buildDiagnosticCollection: vscode.DiagnosticCollection;

function registerLanguageFeatures(ctx: vscode.ExtensionContext)
{
  //ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => watchLanguageServerConfiguration(e)));
	//const config = parseLanguageServerConfig();

	ctx.subscriptions.push(vscode.languages.registerCompletionItemProvider(SING_MODE, new SingCompletionItemProvider(ctx.globalState), '.', '"'));
	// ctx.subscriptions.push(vscode.languages.registerHoverProvider(GO_MODE, new GoHoverProvider()));
	// ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(GO_MODE, new GoDefinitionProvider()));
	// ctx.subscriptions.push(vscode.languages.registerReferenceProvider(GO_MODE, new GoReferenceProvider()));
	// ctx.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(GO_MODE, new GoDocumentSymbolProvider()));
	// ctx.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new GoWorkspaceSymbolProvider()));
	// ctx.subscriptions.push(
	// 	vscode.languages.registerSignatureHelpProvider(GO_MODE, new GoSignatureHelpProvider(), '(', ',')
	// );
	// ctx.subscriptions.push(vscode.languages.registerImplementationProvider(GO_MODE, new GoImplementationProvider()));
	// ctx.subscriptions.push(
	// 	vscode.languages.registerDocumentFormattingEditProvider(GO_MODE, new GoDocumentFormattingEditProvider())
	// );
	// ctx.subscriptions.push(vscode.languages.registerTypeDefinitionProvider(GO_MODE, new GoTypeDefinitionProvider()));
	// ctx.subscriptions.push(vscode.languages.registerRenameProvider(GO_MODE, new GoRenameProvider()));

	// register diagnostic services (squiggles)
	buildDiagnosticCollection = vscode.languages.createDiagnosticCollection('sing');
	ctx.subscriptions.push(buildDiagnosticCollection);
	vscode.workspace.onDidChangeTextDocument(parseLiveFile, null, ctx.subscriptions);
}

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('extension.mock-debug.getProgramName', config => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a markdown file in the workspace folder",
			value: "readme.md"
		});
	}));

	// register a configuration provider for 'sing' debug type
	const provider = new MockConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('mock', provider));

	// register a dynamic configuration provider for 'mock' debug type
	// context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('mock', {
	// 	provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
	// 		return [
	// 			{
	// 				name: "Dynamic Launch",
	// 				request: "launch",
	// 				type: "node",
	// 				program: "${file}"
	// 			},
	// 			{
	// 				name: "Another Dynamic Launch",
	// 				request: "launch",
	// 				type: "node",
	// 				program: "${file}"
	// 			},
	// 			{
	// 				name: "Mock Launch",
	// 				request: "launch",
	// 				type: "node",
	// 				program: "${file}"
	// 			}
	// 		];
	// 	}
	// }, vscode.DebugConfigurationProviderScope.Dynamic));

	// debug adapters can be run in different ways by using a vscode.DebugAdapterDescriptorFactory:
	let factory: vscode.DebugAdapterDescriptorFactory;
	switch (runMode) {
		case 'server':
			// run the debug adapter as a server inside the extension and communicating via a socket
			factory = new MockDebugAdapterDescriptorFactory();
			break;

		case 'inline':
			// run the debug adapter inside the extension and directly talk to it
			factory = new InlineDebugAdapterFactory();
			break;

		case 'external': default:
			// run the debug adapter as a separate process
			factory = new DebugAdapterExecutableFactory();
			break;
		}

	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('mock', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}

	// test command
	context.subscriptions.push(vscode.commands.registerCommand('helloworld.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		var child = cp.execFile("C:/works/GitHub/sing/server/bin/ssrv_d.exe", ["arg1"]);

		if (child.stdin != null) {
			  child.stdin.write("Hello my child!\n");
		}

		if (child.stdout != null) {
			child.stdout.on('data', (data) => {
				vscode.window.showInformationMessage(data);
			});
		}

		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World from Degi\'s HelloWorld!');
	}));

	/*
	* Language programmatic features start
	*/
	registerLanguageFeatures(context);

	// override VS Code's default implementation of the debug hover
	/*
	vscode.languages.registerEvaluatableExpressionProvider('markdown', {
		provideEvaluatableExpression(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.EvaluatableExpression> {
			const wordRange = document.getWordRangeAtPosition(position);
			return wordRange ? new vscode.EvaluatableExpression(wordRange) : undefined;
		}
	});
	*/
}

export function deactivate() {
	// nothing to do
}

class MockConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'markdown') {
				config.type = 'mock';
				config.name = 'Launch';
				config.request = 'launch';
				config.program = '${file}';
				config.stopOnEntry = true;
			}
		}

		if (!config.program) {
			return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
				return undefined;	// abort launch
			});
		}

		return config;
	}
}

class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {

	// The following use of a DebugAdapter factory shows how to control what debug adapter executable is used.
	// Since the code implements the default behavior, it is absolutely not neccessary and we show it here only for educational purpose.

	createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
		// param "executable" contains the executable optionally specified in the package.json (if any)

		// use the executable specified in the package.json if it exists or determine it based on some other information (e.g. the session)
		if (!executable) {
			const command = "absolute path to my DA executable";
			const args = [
				"some args",
				"another arg"
			];
			const options = {
				cwd: "working directory for executable",
				env: { "VAR": "some value" }
			};
			executable = new vscode.DebugAdapterExecutable(command, args, options);
		}

		// make VS Code launch the DA executable
		return executable;
	}
}

class MockDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

	private server?: Net.Server;

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

		if (!this.server) {
			// start listening on a random port
			this.server = Net.createServer(socket => {
				const session = new MockDebugSession();
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer((<Net.AddressInfo>this.server.address()).port);
	}

	dispose() {
		if (this.server) {
			this.server.close();
		}
	}
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new MockDebugSession());
	}
}

/*
* Language programmatic features start
*/
function parseLiveFile(e: vscode.TextDocumentChangeEvent) {
	if (e.document.isUntitled) {
		return;
	}
	if (e.document.languageId !== 'singlang') {
		return;
	}

	buildDiagnosticCollection.clear();
	//const diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map(); // In case I have more uris
	let diagnostics: vscode.Diagnostic[] = [];

	let text = e.document.getText();
	let pattern = /\b[A-Z]{2,}\b/g;
	let problems = 0;
	let m: RegExpExecArray | null;
	while ((m = pattern.exec(text)) && problems < 10) {
		problems++;
		const error_range  : vscode.Range = new vscode.Range (
			e.document.positionAt(m.index),
			e.document.positionAt(m.index + m[0].length)
		);
		const diagnostic_item: vscode.Diagnostic = {
			severity: vscode.DiagnosticSeverity.Warning,
			range: error_range,
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		diagnostics.push(diagnostic_item);
	}
	buildDiagnosticCollection.set(e.document.uri, diagnostics);
}
