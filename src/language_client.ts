'use strict';

import cp = require('child_process');
import vscode = require('vscode');
import os = require('os');

class wrappedstring {
	public data:string;
}

export class LanguageClient implements vscode.CompletionItemProvider,
										vscode.SignatureHelpProvider,
										vscode.DefinitionProvider,
										vscode.DocumentSymbolProvider
{
	// the server
	private server: cp.ChildProcess;
	private server_on: boolean;

	// diag updates
	private buildDiagnosticCollection: vscode.DiagnosticCollection;
	private timer_pending: boolean;
	private timer_id;
	private diagnostics: vscode.Diagnostic[] = [];
	private dec2hex: string[] = [
		"0", "1", "2", "3", "4", "5", "6", "7",
		"8", "9", "A", "B", "C", "D", "E", "F"];

	// auto completion
	private completion_list : vscode.CompletionList;
	private completion_callback;

	// signature help
	private signature_help : vscode.SignatureHelp;
	private signature_callback;

	// find definitions
	private def_locations : vscode.Location[];
	private def_find_callback;

	// list all symbols
	private all_symbols : vscode.SymbolInformation[];
	private all_symbols_file : vscode.Uri;
	private all_symbols_callback;

	constructor(ctx: vscode.ExtensionContext)
	{
		// collect some filenames from sdk
		var hh_path = "sdk/sing_headers";
		var srv_path = "";
		if (os.platform() == 'win32') {
			srv_path = "sdk/win/bin/sing";
		} else {
			srv_path = "sdk/linux/bin/sing";
		}
		srv_path = ctx.asAbsolutePath(srv_path);
		hh_path = ctx.asAbsolutePath(hh_path);

		// workspace directory
		var work_folders = vscode.workspace.workspaceFolders;
		if (work_folders == null) {
			this.server_on = false;
			return;
		}
		var workpath = work_folders[0].uri.fsPath;

		// collect include dirs for intellisense
		var srv_arguments : string[] = ["-s", "-I", hh_path];

		var linefun = function(line : string) {
			if (line != "") {
				srv_arguments.push("-I");
				srv_arguments.push(workpath + "/" + line);
			}
		}
		var file_content: string;
		try {
			file_content = require('fs').readFileSync(workpath + "/.vscode/sing_sense.txt", 'utf-8');
			file_content.split(/\r?\n/).forEach(linefun);
		} catch (err) {
		}

		// run it !!
		this.server = cp.execFile(srv_path, srv_arguments, {cwd:workpath});

		this.server.on('error', this.server_error.bind(this));
		if (this.server.stdin != null && this.server.stdout != null) {
			this.server.stdout.setEncoding('utf8');
			const boundrx = this.receiver.bind(this);
			this.server.stdout.on('data', boundrx);
			this.server_on = true;
	    } else {
			this.server_on = false;
			return;
		}

		// init squiggles (create errors collectin and hook all the relevant events)
		this.buildDiagnosticCollection = vscode.languages.createDiagnosticCollection('sing');
		vscode.workspace.onDidChangeTextDocument(this.onChange, this, ctx.subscriptions);
		vscode.workspace.onDidCreateFiles(this.onCreate, this, ctx.subscriptions);
		vscode.workspace.onDidDeleteFiles(this.onDelete, this, ctx.subscriptions);
		vscode.workspace.onDidOpenTextDocument(this.onOpen, this, ctx.subscriptions);
		vscode.workspace.onDidRenameFiles(this.onRename, this, ctx.subscriptions);
		vscode.workspace.onDidSaveTextDocument(this.onSave, this, ctx.subscriptions);
		vscode.window.onDidChangeActiveTextEditor(this.onDocumentSwitch, this, ctx.subscriptions);

		this.timer_pending = false;
		this.triggerDiagUpdate();
	}

	server_error(data:string)
	{
		this.server_on = false;
	}

	dispose() {
		this.buildDiagnosticCollection.dispose();
		if (this.server_on && this.server.stdin != null) {
			this.server.stdin.write("exit\r\n");
		}
	}

	/////////////////////
	//  Utilities
	/////////////////////
	string2utf8hex(str:string, start:number, maxitems:number, output:wrappedstring) {
		var utf8:number[] = [];
		let top = str.length;
		let end = start + maxitems;
		if (end < top) top = end;
		for (var i=start; i < top; i++) {
			var charcode = str.charCodeAt(i);
			if (charcode < 0x80) {
				utf8.push(charcode);
			} else if (charcode < 0x800) {
				utf8.push(0xc0 | (charcode >> 6),
						  0x80 | (charcode & 0x3f));
			}
			else if (charcode < 0xd800 || charcode >= 0xe000) {
				utf8.push(0xe0 | (charcode >> 12),
						  0x80 | ((charcode>>6) & 0x3f),
						  0x80 | (charcode & 0x3f));
			}
			// surrogate pair
			else {
				i++;
				// UTF-16 encodes 0x10000-0x10FFFF by
				// subtracting 0x10000 and splitting the
				// 20 bits of 0x0-0xFFFFF into two halves
				charcode = 0x10000 + (((charcode & 0x3ff)<<10)
						  | (str.charCodeAt(i) & 0x3ff));
				utf8.push(0xf0 | (charcode >>18),
						  0x80 | ((charcode>>12) & 0x3f),
						  0x80 | ((charcode>>6) & 0x3f),
						  0x80 | (charcode & 0x3f));
			}
		}
		let len:number = utf8.length;
		if (len == 0) {
			output.data += '""';
		} else {
			for (var j = 0; j < len; j++) {
				let num = utf8[j] & 0xff;
				output.data += this.dec2hex[num >> 4];
				output.data += this.dec2hex[num & 15];
			}
		}
		return(i);
	}

	escapeString(str:string)
	{
		let output:string = str;
		output = output.replace(/\\/g, '/');
		output = output.replace(/\"/g, '\\\"');
		return('"' + output + '"');
	}

	splitArguments(output:string[], str:string, from:number)
	{
		var status = 0;
		var newstring:string = '';
		for (var i = from; i < str.length; i++) {
			var charcode = str.charCodeAt(i);

			// if \r or \n and not in a string parm
			if ((charcode == 13 || charcode == 10) && status != 2) {
				do {
					charcode = str.charCodeAt(++i);
				} while (i < str.length && (charcode == 13 || charcode == 10));
				break;
			}

			if (status == 0) {

				// skip leading blanks
				if (charcode == 0x22) {
					newstring = '';
					status = 2;
				} else if (charcode != 32) {
					newstring = String.fromCharCode(charcode);
					status = 1;
				}
			} else if (status == 1) {

				// collect blank separated parm
				if (charcode != 32) {
					newstring += String.fromCharCode(charcode);
				} else {
					output.push(newstring);
					status = 0;
				}
			} else if (status == 2) {

				// collect an escaped string
				if (charcode == 0x5c) {
					newstring += String.fromCharCode(str.charCodeAt(i + 1));
					++i;
				} else if (charcode != 0x22) {
					newstring += String.fromCharCode(charcode);
				} else {
					output.push(newstring);
					status = 0;
				}
			}
		}
		if (status != 0) {
			output.push(newstring);
		}
		return(i);
	}

	public str2rowcol(argument : string) : number
	{
		let ret = parseInt(argument, 10) - 1;
		if (ret < 0) ret = 0;
		return(ret);
	}

	/////////////////////
	//  Keeping the document's images updated
	/////////////////////

	onOpen(e: vscode.TextDocument) {
		if (this.server_on && e.languageId == 'singlang') {
			this.server.stdin?.write("src_read " + this.escapeString(e.fileName) + "\r\n");
			this.triggerDiagUpdate();
		}
	}

	onCreate(e: vscode.FileCreateEvent) {
		if (this.server_on) {
			var ii : number;
			for (ii = 0; ii < e.files.length; ++ii) {
				if (e.files[ii].fsPath.endsWith('sing')) {
					this.server.stdin?.write("src_created " + this.escapeString(e.files[ii].fsPath) + "\r\n");
				}
			}
		}
	}

	onChange(e: vscode.TextDocumentChangeEvent) {
		if (this.server_on && e.document.languageId == 'singlang' && !e.document.isUntitled) {
			let ii : number;
			let filename = this.escapeString(e.document.fileName);
			for (ii = 0; ii < e.contentChanges.length; ++ii) {
				let change = e.contentChanges[ii];
				let total = change.text.length;
				let written = 0;
				let chunk = 256;

				// build src_change command with first chunk of data
				let command = "src_change " + filename + " ";
				command += (change.range.start.line + 1).toString() + " ";
				command += (change.range.start.character + 1).toString() + " ";
				command += (change.range.end.line + 1).toString() + " ";
				command += (change.range.end.character + 1).toString() + " ";
				if (total > chunk) {
					command += total.toString() + " ";
				} else {
					command += "0 ";
				}
				let towrite = total;
				if (towrite > chunk) {
					towrite = chunk;
				}
				let cmd:wrappedstring = new wrappedstring;
				cmd.data = command;
				written = this.string2utf8hex(change.text, 0, towrite, cmd);
				cmd.data += "\r\n";
				this.server.stdin?.write(cmd.data);

				// if required, send other chunks of data
				while (written < total) {
					command = "src_insert " + filename + " ";
					let towrite = total - written;
					if (towrite > chunk) {
						towrite = chunk;
					}
					cmd.data = command;
					written = this.string2utf8hex(change.text, written, towrite, cmd);
					cmd.data += "\r\n";
					this.server.stdin?.write(cmd.data);
				}
			}
			if (e.contentChanges.length > 0) {
				this.triggerDiagUpdate();
			}
		}
	}

	onDelete(e: vscode.FileDeleteEvent) {
		if (this.server_on) {
			var ii : number;
			let trigger:boolean = false;
			for (ii = 0; ii < e.files.length; ++ii) {
				if (e.files[ii].fsPath.endsWith('sing')) {
					this.server.stdin?.write("src_deleted " + this.escapeString(e.files[ii].fsPath) + "\r\n");
					trigger = true;
				}
			}
			if (trigger) {
				this.triggerDiagUpdate();
			}
		}
	}

	onRename(e: vscode.FileRenameEvent) {
		if (this.server_on) {
			var ii : number;
			let trigger:boolean = false;
			for (ii = 0; ii < e.files.length; ++ii) {
				if (e.files[ii].newUri.fsPath.endsWith('sing')) {
					this.server.stdin?.write("src_renamed " +
					this.escapeString(e.files[ii].oldUri.fsPath) +
					this.escapeString(e.files[ii].newUri.fsPath) + "\r\n");
					trigger = true;
				}
			}
			if (trigger) {
				this.triggerDiagUpdate();
			}
		}
	}

	onSave(e: vscode.TextDocument) {
		if (this.server_on && e.languageId == 'singlang') {
			this.triggerDiagUpdate(0);
		}
	}

	onDocumentSwitch(e: vscode.TextEditor) {
		if (this.server_on && e.document.languageId == 'singlang') {
			this.triggerDiagUpdate();
		}
	}

	/////////////////////
	//  Requesting a diagnostics update
	/////////////////////

	triggerDiagUpdate(tout:number = 4000) {
		if (this.timer_pending) {
			clearTimeout(this.timer_id);
		}
		const boundTrig = this.askDiagUpdate.bind(this);
		this.timer_id = setTimeout(boundTrig, tout);
		this.timer_pending = true;
	}

	askDiagUpdate() {
		if (this.server_on) {
			let document = vscode.window.activeTextEditor?.document;
			if (document != null && document.languageId == 'singlang') {
				this.server.stdin?.write("get_errors " + this.escapeString(document.fileName) + "\r\n");
			}
		}
		this.timer_pending = false;
	}

	/////////////////////
	//  Handling server messages
	/////////////////////

	receiver(data:string)
	{
		let done = 0;
		while (data.length - done > 3) {
			let parts : string[] = [];
			done = this.splitArguments(parts, data, done);
			if (parts.length < 1) {
				continue;
			}
			switch (parts[0]) {
			case 'set_error':
				if (parts.length < 6) {
					return;
				}
				let start_row = this.str2rowcol(parts[2]);
				let start_col = this.str2rowcol(parts[3]);
				let end_row = this.str2rowcol(parts[4]);
				let end_col = this.str2rowcol(parts[5]);
				let startpos: vscode.Position = new vscode.Position(start_row, start_col);
				let endpos: vscode.Position = new vscode.Position(end_row, end_col);
				const error_range  : vscode.Range = new vscode.Range (startpos, endpos);
				const diagnostic_item: vscode.Diagnostic = {
					severity: vscode.DiagnosticSeverity.Error,
					range: error_range,
					message: parts[1],
					source: 'singlang'
				};
				this.diagnostics.push(diagnostic_item);
				break;
			case 'set_errors_done':
				this.buildDiagnosticCollection.set(vscode.Uri.file(parts[1]), this.diagnostics);
				this.diagnostics = [];
				break;
			case 'set_completion_item':
				if (parts.length == 2 && this.completion_list != null) {
					this.completion_list.items.push(new vscode.CompletionItem(parts[1]));
				}
				break;
			case 'set_completions_done':
				if (this.completion_list != null) {
					this.completion_callback(this.completion_list);
				}
				break;
			case 'set_signature':
				if (parts.length == 3 && this.signature_help != null) {
					this.signature_help.activeParameter = parseInt(parts[2], 10);
					if (this.signature_help.activeParameter < 0) this.signature_help.activeParameter = 0;
					this.signature_help.activeSignature = 0;
					if (parts[1] != "empty") {
						let info = new vscode.SignatureInformation(parts[1]);
						this.setSignatures(info, parts[1]);
						this.signature_help.signatures.push(info);
					}
					this.signature_callback(this.signature_help);
				}
				break;
			case 'definition_of':
				if (parts.length == 4) {
					if (parts[1] != "empty") {
						let position = new vscode.Position(this.str2rowcol(parts[2]) + 1, this.str2rowcol(parts[3]) + 1);
						let location = new vscode.Location(vscode.Uri.file(parts[1]), position);
						this.def_locations.push(location);
					}
					this.def_find_callback(this.def_locations);
				}
				break;
			case 'set_symbol':
				if (parts.length == 5) {
					let row = this.str2rowcol(parts[3]) + 1;
					let col = this.str2rowcol(parts[4]) + 1;
					var location = new vscode.Location(this.all_symbols_file, new vscode.Position(row, col));
					var nfo = new vscode.SymbolInformation(parts[1], parseInt(parts[2], 10), "", location);
					this.all_symbols.push(nfo);
				}
				break;
			case 'set_symbols_done':
				if (this.all_symbols != null) {
					this.all_symbols_callback(this.all_symbols);
				}
				break;
			}
		}
		// for debug
		// vscode.window.showInformationMessage(data);
	}

	private setSignatures(info : vscode.SignatureInformation, signature : string)
	{
		let level = 0;
		var start = 0;
		for (var i = 0; i < signature.length; i++) {
			let char = signature.charAt(i);
			if (char == '(') {
				++level;
				if (level == 1) {
					start = i + 1;
				}
			} else if (char == ',' && level == 1) {
				if (start != 0) {
					info.parameters.push(new vscode.ParameterInformation([start, i - 1]));
				}
				start = i + 1;
			} else if (char == ')') {
				--level;
				if (level == 0) {
					if (start != 0) {
						info.parameters.push(new vscode.ParameterInformation([start, i - 1]));
					}
					break;
				}
			}
		}
	}

	/////////////////////
	//  Completion Hints
	/////////////////////

	// completion hint for '.', "/", ":" and '"'
	public provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): vscode.ProviderResult<vscode.CompletionList> {
		if (this.server_on && context.triggerCharacter != null) {
			if (document != null && document.languageId == 'singlang') {
				this.completion_list = new vscode.CompletionList([], false);
				this.server.stdin?.write("completion_items " +
					this.escapeString(document.fileName) + " " +
					(position.line + 1).toString() + " " +
					position.character.toString() + " " +	// not incremented: convert from insertion to trigger position.
					this.escapeString(context.triggerCharacter) +
					"\r\n");
				return new Promise(this.completionWorker.bind(this));
			}
		}
		return(null);
	}

	public resolveCompletionItem(
		item: vscode.CompletionItem,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CompletionItem> {
        return;
	}

	public completionWorker(resolve, reject)
	{
		this.completion_callback = resolve;
	}

	/////////////////////
	//  Signature Hints
	/////////////////////
	public provideSignatureHelp(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.SignatureHelpContext): vscode.ProviderResult<vscode.SignatureHelp>
	{
		if (this.server_on && context.triggerCharacter != null) {
			if (document != null && document.languageId == 'singlang') {
				this.signature_help = new vscode.SignatureHelp();
				this.server.stdin?.write("signature " +
					this.escapeString(document.fileName) + " " +
					(position.line + 1).toString() + " " +
					position.character.toString() + " " +	// not incremented: convert from insertion to trigger position.
					this.escapeString(context.triggerCharacter) +
					"\r\n");
				return new Promise(this.signatureWorker.bind(this));
			}
		}
		return(null);
	}

	public signatureWorker(resolve, reject)
	{
		this.signature_callback = resolve;
	}

	/////////////////////
	//  Finding a symbol
	/////////////////////
	public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]>
	{
		if (this.server_on) {
			if (document != null && document.languageId == 'singlang') {
				this.def_locations = [];
				this.server.stdin?.write("def_position " +
					this.escapeString(document.fileName) + " " +
					(position.line + 1).toString() + " " +
					position.character.toString() +		// not incremented: convert from insertion to trigger position.
					"\r\n");
				return new Promise(this.defFindWorker.bind(this));
			}
		}
		return(null);
	}

	public defFindWorker(resolve, reject)
	{
		this.def_find_callback = resolve;
	}

	/////////////////////
	//  Symbol provider
	/////////////////////
	public provideDocumentSymbols(
		document: vscode.TextDocument,
		token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>
	{
		if (this.server_on) {
			if (document != null && document.languageId == 'singlang') {
				this.all_symbols = [];
				this.all_symbols_file = vscode.Uri.file(document.fileName);
				this.server.stdin?.write("get_symbols " +
					this.escapeString(document.fileName) + "\r\n");
				return new Promise(this.allSymbolsWorker.bind(this));
			}
		}
		return(null);
	}

	public allSymbolsWorker(resolve, reject)
	{
		this.all_symbols_callback = resolve;
	}
}