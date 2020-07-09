'use strict';

//import cp = require('child_process');
//import path = require('path');
import vscode = require('vscode');

export class SingCompletionItemProvider implements vscode.CompletionItemProvider {
	//private pkgsList = new Map<string, PackageInfo>();
	//private killMsgShown: boolean = false;
	//private setGocodeOptions: boolean = true;
	//private isGoMod: boolean = false;
	//private globalState: vscode.Memento;
	//private previousFile: string;
	//private previousFileDir: string;
	//private gocodeFlags: string[];
	//private excludeDocs: boolean = false;

	constructor(globalState?: vscode.Memento) {
		//this.globalState = globalState;
	}

	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.CompletionList {
        return new vscode.CompletionList([], false);
	}

	public resolveCompletionItem(
		item: vscode.CompletionItem,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CompletionItem> {
        return;
	}

}