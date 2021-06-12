# vscode-sing

visual studio code plugin for the [sing language](https://mdegirolami.wixsite.com/singlang).

Compiler repository at <https://github.com/mdegirolami/sing>

Plugin repository at <https://github.com/mdegirolami/vscode-sing>

This is the very first release of the compiler and plugin so please, if you find some bug (you are very likely to), file an issue on
<https://github.com/mdegirolami/vscode-sing/issues>

Thank in advance for your patience.

Features
========
This version offers:
- a ninja file generator for hibrid c++/sing projects
- the sing compiler
- syntax highlighting
- on the fly error checking in the editor
- auto-completion on
  - class members
  - enum cases
  - extern items
  - embedded functions
  - inclusion paths
  - named arguments
- signature provider (suggests function arguments)
- definition provider (find your definitions with F12)
- symbols provider (ctl-shift-O to bring up a list of all the symbols in a file)

I'm sorry there is currently no sing Debugger. You have to debug the c++ generated from the sing compiler.


